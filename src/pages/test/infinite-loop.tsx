import { useState, useEffect } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import { useGameQuery } from '@/hooks/useGameQueries';

// Test component to isolate the infinite loop issue
export default function InfiniteLoopTest() {
  const [testCase, setTestCase] = useState<string>('none');
  const [error, setError] = useState<string | null>(null);
  
  // Track render count
  const [renderCount, setRenderCount] = useState(0);
  useEffect(() => {
    setRenderCount(c => c + 1);
  }, []); // Add empty dependency array to only run once per mount

  return (
    <Box sx={{ p: 4, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Infinite Loop Test Page
      </Typography>
      
      <Paper sx={{ p: 2, mb: 2, bgcolor: '#333' }}>
        <Typography>Render count: {renderCount}</Typography>
        {error && (
          <Typography color="error">Error: {error}</Typography>
        )}
      </Paper>
      
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Button 
          variant="contained" 
          onClick={() => setTestCase('store-basic')}
        >
          Test 1: Basic Store Access
        </Button>
        
        <Button 
          variant="contained" 
          onClick={() => setTestCase('store-functions')}
        >
          Test 2: Store with Function Calls
        </Button>
        
        <Button 
          variant="contained" 
          onClick={() => setTestCase('game-query')}
        >
          Test 3: useGameQuery Hook
        </Button>
        
        <Button 
          variant="contained" 
          onClick={() => setTestCase('game-board')}
        >
          Test 4: GameBoard Components
        </Button>
        
        <Button 
          variant="outlined" 
          onClick={() => {
            setTestCase('none');
            setError(null);
            setRenderCount(0);
          }}
        >
          Reset
        </Button>
      </Box>
      
      <Box sx={{ mt: 4 }}>
        {testCase === 'store-basic' && <TestStoreBasic />}
        {testCase === 'store-functions' && <TestStoreFunctions />}
        {testCase === 'game-query' && <TestGameQuery />}
        {testCase === 'game-board' && <TestGameBoard />}
      </Box>
    </Box>
  );
}

// Test 1: Basic store access without functions
function TestStoreBasic() {
  const game = useUnifiedGameStore(s => s.game);
  const myColor = useUnifiedGameStore(s => s.myColor);
  const phase = useUnifiedGameStore(s => s.phase);
  
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6">Test 1: Basic Store Access</Typography>
      <Typography>Game: {game ? 'Loaded' : 'Not loaded'}</Typography>
      <Typography>My Color: {myColor || 'None'}</Typography>
      <Typography>Phase: {phase}</Typography>
    </Paper>
  );
}

// Test 2: Store with function calls (the problematic pattern)
function TestStoreFunctions() {
  // DON'T call functions in selectors - it causes infinite loops!
  // DON'T create new objects in selectors either!
  // Use individual selectors instead
  const mode = useUnifiedGameStore(s => s.mode);
  const phase = useUnifiedGameStore(s => s.phase);
  const game = useUnifiedGameStore(s => s.game);
  const myColor = useUnifiedGameStore(s => s.myColor);
  
  // Calculate values outside the selector
  const canMove = mode === 'local'
    ? (phase === 'making_move' && game?.status === 'active')
    : (phase === 'making_move' && game?.turn === myColor && game?.status === 'active');
    
  const canBan = mode === 'local' 
    ? (phase === 'selecting_ban' && game?.status === 'active')
    : phase === 'selecting_ban';
    
  const isMyTurn = mode === 'local' 
    ? true
    : (mode !== 'spectator' && game?.turn === myColor && game?.status === 'active');
  
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6">Test 2: Store with Function Calls (Fixed)</Typography>
      <Typography>Can Move: {canMove ? 'Yes' : 'No'}</Typography>
      <Typography>Can Ban: {canBan ? 'Yes' : 'No'}</Typography>
      <Typography>Is My Turn: {isMyTurn ? 'Yes' : 'No'}</Typography>
    </Paper>
  );
}

// Test 3: useGameQuery hook
function TestGameQuery() {
  // Test with a fake game ID
  const query = useGameQuery('test-game-id', 'test-user-id');
  
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6">Test 3: useGameQuery Hook</Typography>
      <Typography>Loading: {query.isLoading ? 'Yes' : 'No'}</Typography>
      <Typography>Data: {query.data ? 'Loaded' : 'Not loaded'}</Typography>
      <Typography>Error: {query.error ? 'Yes' : 'No'}</Typography>
    </Paper>
  );
}

// Test 4: Simulate GameBoard pattern
function TestGameBoard() {
  // This simulates the GameBoardV2 component pattern
  // FIX: Use individual selectors, not object destructuring in selector
  const game = useUnifiedGameStore(s => s.game);
  const myColor = useUnifiedGameStore(s => s.myColor);
  const phase = useUnifiedGameStore(s => s.phase);
  const mode = useUnifiedGameStore(s => s.mode);
  
  // Calculate canBan and canMove based on the state
  const canBan = mode === 'local' 
    ? (phase === 'selecting_ban' && game?.status === 'active')
    : phase === 'selecting_ban';
    
  const canMove = mode === 'local'
    ? (phase === 'making_move' && game?.status === 'active')
    : (phase === 'making_move' && game?.turn === myColor && game?.status === 'active');
  
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6">Test 4: GameBoard Pattern (Fixed)</Typography>
      <Typography>Mode: {mode}</Typography>
      <Typography>Phase: {phase}</Typography>
      <Typography>Can Move: {canMove ? 'Yes' : 'No'}</Typography>
      <Typography>Can Ban: {canBan ? 'Yes' : 'No'}</Typography>
    </Paper>
  );
}