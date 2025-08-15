import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { CircularProgress, Box, Typography } from '@mui/material';

export default function NewGameTest() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [status, setStatus] = useState('Creating test game...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const createTestGame = async () => {
      try {
        // Get player preference from query param (default to white)
        const { player = 'white' } = router.query;
        const isWhite = player === 'white';
        
        setStatus(`Creating test game (you will be ${isWhite ? 'white' : 'black'})...`);

        // Create test game via API endpoint
        const response = await fetch('/api/test/create-game', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            playAs: isWhite ? 'white' : 'black',
            withBan: router.query.withBan === 'true' // Optional: start with a ban
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to create test game: ${response.statusText}`);
        }

        const { gameId, email, password } = await response.json();
        
        setStatus('Signing in as test user...');
        
        // Sign in using AuthContext to keep it aware of auth changes
        await signIn(email, password);

        setStatus('Redirecting to game...');
        
        // Redirect to the game
        await router.push(`/game/${gameId}`);
        
      } catch (err) {
        console.error('Error creating test game:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      }
    };

    // Only run once router is ready
    if (router.isReady) {
      createTestGame();
    }
  }, [router.isReady, router.query]);

  if (error) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 4 }}>
        <Typography variant="h5" color="error" gutterBottom>
          Error Creating Test Game
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {error}
        </Typography>
        <Typography variant="body2" sx={{ mt: 2 }}>
          <a href="/test/new-game">Try again</a>
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 4 }}>
      <CircularProgress />
      <Typography variant="body1" sx={{ mt: 2 }}>
        {status}
      </Typography>
    </Box>
  );
}