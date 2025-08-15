import { useState, useRef } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import { useGameQuery } from '@/hooks/useGameQueries';

// Track renders without causing re-renders
let globalRenderCount = 0;

export default function LoopDebugTest() {
  const [testCase, setTestCase] = useState<string>('none');
  const renderRef = useRef(0);
  renderRef.current += 1;
  globalRenderCount += 1;
  
  console.log(`[LoopDebugTest] Render #${globalRenderCount}`);

  return (
    <Box sx={{ p: 4, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Loop Debug Test
      </Typography>
      
      <Paper sx={{ p: 2, mb: 2, bgcolor: '#333' }}>
        <Typography>Component renders: {renderRef.current}</Typography>
        <Typography>Global renders: {globalRenderCount}</Typography>
      </Paper>
      
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Button 
          variant="contained" 
          onClick={() => {
            console.log('[Test] Starting Test 1: Basic Store');
            setTestCase('store-basic');
          }}
        >
          Test 1: Basic Store Access
        </Button>
        
        <Button 
          variant="contained" 
          onClick={() => {
            console.log('[Test] Starting Test 2: Store Functions');
            setTestCase('store-functions');
          }}
        >
          Test 2: Store with Function Calls
        </Button>
        
        <Button 
          variant="contained" 
          onClick={() => {
            console.log('[Test] Starting Test 3: GameQuery');
            setTestCase('game-query');
          }}
        >
          Test 3: useGameQuery Hook
        </Button>
        
        <Button 
          variant="outlined" 
          onClick={() => {
            console.log('[Test] Resetting');
            setTestCase('none');
            globalRenderCount = 0;
          }}
        >
          Reset
        </Button>
      </Box>
      
      <Box sx={{ mt: 4 }}>
        {testCase === 'store-basic' && <TestStoreBasic />}
        {testCase === 'store-functions' && <TestStoreFunctions />}
        {testCase === 'game-query' && <TestGameQuery />}
      </Box>
    </Box>
  );
}

// Test 1: Basic store access
function TestStoreBasic() {
  console.log('[TestStoreBasic] Rendering');
  
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

// Test 2: Store with function calls
function TestStoreFunctions() {
  console.log('[TestStoreFunctions] Rendering');
  
  // Don't call functions directly in selector
  const storeState = useUnifiedGameStore(s => ({
    mode: s.mode,
    phase: s.phase,
    game: s.game,
    myColor: s.myColor,
    localPhase: s.localPhase,
    localGameStatus: s.localGameStatus,
  }));
  
  // Calculate values outside
  const canMove = storeState.mode === 'local'
    ? (storeState.localPhase === 'playing' && storeState.localGameStatus === 'active')
    : (storeState.phase === 'making_move' && storeState.game?.turn === storeState.myColor && storeState.game?.status === 'active');
    
  const canBan = storeState.mode === 'local' 
    ? (storeState.localPhase === 'banning' && storeState.localGameStatus === 'active')
    : storeState.phase === 'selecting_ban';
  
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6">Test 2: Store with Calculated Values</Typography>
      <Typography>Can Move: {canMove ? 'Yes' : 'No'}</Typography>
      <Typography>Can Ban: {canBan ? 'Yes' : 'No'}</Typography>
    </Paper>
  );
}

// Test 3: useGameQuery hook
function TestGameQuery() {
  console.log('[TestGameQuery] Rendering');
  
  // Test with a fake game ID
  const query = useGameQuery('test-game-id', 'test-user-id');
  
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6">Test 3: useGameQuery Hook</Typography>
      <Typography>Loading: {query.isLoading ? 'Yes' : 'No'}</Typography>
      <Typography>Data: {query.data ? 'Loaded' : 'Not loaded'}</Typography>
      <Typography>Error: {query.error ? String(query.error) : 'None'}</Typography>
    </Paper>
  );
}