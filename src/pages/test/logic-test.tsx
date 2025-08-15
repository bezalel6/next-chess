import { useState, useEffect, useCallback } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  Paper, 
  Button, 
  Grid, 
  Divider,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Collapse,
  Card,
  CardContent,
  CardActions,
  Switch,
  FormControlLabel
} from '@mui/material';
import { 
  PlayArrow, 
  Stop, 
  Refresh, 
  CheckCircle, 
  Error as ErrorIcon,
  Warning,
  ExpandMore,
  ExpandLess,
  Speed,
  BugReport,
  Science
} from '@mui/icons-material';
import { Chess } from 'chess.ts';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import { supabase } from '@/utils/supabase';
import type { Square } from 'chess.ts/dist/types';

type TestResult = {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'warning';
  message?: string;
  details?: any;
  duration?: number;
  timestamp: Date;
};

type TestScenario = {
  id: string;
  name: string;
  description: string;
  category: 'move' | 'ban' | 'state' | 'integration' | 'performance';
  steps: TestStep[];
  expectedOutcome?: string;
};

type TestStep = {
  type: 'move' | 'ban' | 'verify' | 'reset' | 'wait' | 'custom';
  data?: any;
  description?: string;
};

export default function LogicTestPage() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [currentTest, setCurrentTest] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());
  const [autoMode, setAutoMode] = useState(false);
  const [testSpeed, setTestSpeed] = useState(100);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showOnlyFailed, setShowOnlyFailed] = useState(false);
  
  const store = useUnifiedGameStore();
  const { chess, currentFen, phase, currentTurn, currentBannedMove, moveHistory } = store;

  const addLog = useCallback((message: string, type: 'info' | 'error' | 'warning' | 'success' = 'info') => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const emoji = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
    const newLog = `[${timestamp}] ${emoji} ${message}`;
    setLogs(prev => [newLog, ...prev].slice(0, 100));
    console.log(`[LogicTest] ${message}`);
  }, []);

  const addTestResult = useCallback((result: Omit<TestResult, 'id' | 'timestamp'>) => {
    const newResult: TestResult = {
      ...result,
      id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };
    setTestResults(prev => [newResult, ...prev]);
    return newResult;
  }, []);

  const testScenarios: TestScenario[] = [
    {
      id: 'basic-ban',
      name: 'Basic Ban Test',
      description: 'Tests the most basic ban operation',
      category: 'ban',
      steps: [
        { type: 'reset' },
        { type: 'wait', data: { duration: 200 } },
        { type: 'verify', data: { phase: 'selecting_ban' } },
        { type: 'ban', data: { from: 'e2', to: 'e4' }, description: 'Black bans e2-e4' },
        { type: 'wait', data: { duration: 200 } },
        { type: 'verify', data: { banCount: 1 } }
      ],
      expectedOutcome: 'Ban is registered correctly'
    },
    {
      id: 'basic-move',
      name: 'Basic Move Validation',
      description: 'Tests if basic chess moves work correctly',
      category: 'move',
      steps: [
        { type: 'reset' },
        { type: 'wait', data: { duration: 200 } },
        { type: 'ban', data: { from: 'e2', to: 'e4' }, description: 'Black bans e2-e4' },
        { type: 'wait', data: { duration: 200 } },
        { type: 'move', data: { from: 'd2', to: 'd4' }, description: 'White plays d2-d4 instead' },
        { type: 'wait', data: { duration: 200 } },
        { type: 'verify', data: { moveCount: 1 } }
      ],
      expectedOutcome: 'Moves execute correctly'
    },
    {
      id: 'ban-mechanism',
      name: 'Ban Mechanism Test',
      description: 'Tests the ban chess variant rules',
      category: 'ban',
      steps: [
        { type: 'reset' },
        { type: 'ban', data: { from: 'e2', to: 'e4' }, description: 'Black bans e2-e4' },
        { type: 'verify', data: { bannedMove: { from: 'e2', to: 'e4' } } },
        { type: 'move', data: { from: 'd2', to: 'd4' }, description: 'White plays d4 instead' },
        { type: 'verify', data: { phase: 'selecting_ban' } }
      ],
      expectedOutcome: 'Ban prevents specific move and game continues'
    },
    {
      id: 'illegal-move-prevention',
      name: 'Illegal Move Prevention',
      description: 'Ensures illegal moves are rejected',
      category: 'move',
      steps: [
        { type: 'reset' },
        { type: 'custom', data: { action: 'tryIllegalMove', from: 'e1', to: 'e3' } }
      ],
      expectedOutcome: 'Illegal moves are properly rejected'
    },
    {
      id: 'castling-rights',
      name: 'Castling Rights Test',
      description: 'Verifies castling mechanics',
      category: 'move',
      steps: [
        { type: 'reset' },
        { type: 'move', data: { from: 'e2', to: 'e4' } },
        { type: 'move', data: { from: 'e7', to: 'e5' } },
        { type: 'move', data: { from: 'g1', to: 'f3' } },
        { type: 'move', data: { from: 'b8', to: 'c6' } },
        { type: 'move', data: { from: 'f1', to: 'e2' } },
        { type: 'move', data: { from: 'g8', to: 'f6' } },
        { type: 'move', data: { from: 'e1', to: 'g1' }, description: 'White castles kingside' },
        { type: 'verify', data: { castled: true, fen: /Rf1/ } }
      ],
      expectedOutcome: 'Castling executes correctly'
    },
    {
      id: 'en-passant',
      name: 'En Passant Capture',
      description: 'Tests en passant special move',
      category: 'move',
      steps: [
        { type: 'reset' },
        { type: 'move', data: { from: 'e2', to: 'e4' } },
        { type: 'move', data: { from: 'a7', to: 'a5' } },
        { type: 'move', data: { from: 'e4', to: 'e5' } },
        { type: 'move', data: { from: 'd7', to: 'd5' } },
        { type: 'move', data: { from: 'e5', to: 'd6' }, description: 'En passant capture' },
        { type: 'verify', data: { captured: true, capturedPawn: 'd5' } }
      ],
      expectedOutcome: 'En passant capture works correctly'
    },
    {
      id: 'promotion',
      name: 'Pawn Promotion',
      description: 'Tests pawn promotion mechanics',
      category: 'move',
      steps: [
        { type: 'custom', data: { action: 'setupPromotion' } },
        { type: 'move', data: { from: 'a7', to: 'a8', promotion: 'q' }, description: 'Promote to queen' },
        { type: 'verify', data: { promoted: true, piece: 'queen' } }
      ],
      expectedOutcome: 'Pawn promotes correctly'
    },
    {
      id: 'checkmate-detection',
      name: 'Checkmate Detection',
      description: 'Verifies checkmate is properly detected',
      category: 'state',
      steps: [
        { type: 'custom', data: { action: 'setupCheckmate' } },
        { type: 'verify', data: { checkmate: true, gameOver: true } }
      ],
      expectedOutcome: 'Checkmate ends the game'
    },
    {
      id: 'stalemate-detection',
      name: 'Stalemate Detection',
      description: 'Verifies stalemate is properly detected',
      category: 'state',
      steps: [
        { type: 'custom', data: { action: 'setupStalemate' } },
        { type: 'verify', data: { stalemate: true, gameOver: true, draw: true } }
      ],
      expectedOutcome: 'Stalemate results in draw'
    },
    {
      id: 'ban-chain',
      name: 'Sequential Ban Test',
      description: 'Tests multiple bans in sequence',
      category: 'ban',
      steps: [
        { type: 'reset' },
        { type: 'ban', data: { from: 'e2', to: 'e4' } },
        { type: 'move', data: { from: 'd2', to: 'd4' } },
        { type: 'ban', data: { from: 'e7', to: 'e5' } },
        { type: 'move', data: { from: 'd7', to: 'd5' } },
        { type: 'verify', data: { banCount: 2, moveCount: 2 } }
      ],
      expectedOutcome: 'Bans and moves alternate correctly'
    },
    {
      id: 'performance-test',
      name: 'Performance Stress Test',
      description: 'Tests system under rapid operations',
      category: 'performance',
      steps: [
        { type: 'custom', data: { action: 'performanceTest', operations: 100 } },
        { type: 'verify', data: { performance: true, threshold: 1000 } }
      ],
      expectedOutcome: 'System handles rapid operations efficiently'
    }
  ];

  const runTestStep = async (step: TestStep): Promise<{ success: boolean; message?: string; data?: any }> => {
    try {
      switch (step.type) {
        case 'reset':
          // Initialize a fresh local game
          store.initLocalGame();
          await new Promise(resolve => setTimeout(resolve, 100));
          // Get fresh state directly from the store
          const freshState = useUnifiedGameStore.getState();
          console.log(`[Test] After reset - phase: ${freshState.phase}, turn: ${freshState.currentTurn}`);
          return { success: true, message: 'Game reset' };

        case 'move':
          const moveResult = store.executeMove(
            step.data.from as Square,
            step.data.to as Square,
            step.data.promotion
          );
          if (!moveResult) {
            return { success: false, message: `Move failed: ${step.data.from}-${step.data.to}` };
          }
          await new Promise(resolve => setTimeout(resolve, testSpeed));
          return { success: true, message: `Move executed: ${step.description || `${step.data.from}-${step.data.to}`}` };

        case 'ban':
          const banResult = store.executeBan(
            step.data.from as Square,
            step.data.to as Square
          );
          if (!banResult) {
            return { success: false, message: `Ban failed: ${step.data.from}-${step.data.to}` };
          }
          // Wait a bit longer for state to update
          await new Promise(resolve => setTimeout(resolve, testSpeed + 50));
          
          // Log the current state after ban
          const afterBanState = useUnifiedGameStore.getState();
          console.log(`[Test] After ban - phase: ${afterBanState.phase}, bannedMove: ${JSON.stringify(afterBanState.currentBannedMove)}`);
          
          return { success: true, message: `Ban executed: ${step.description || `${step.data.from}-${step.data.to}`}` };

        case 'verify':
          const verifications = step.data;
          const results: any = {};
          
          for (const [key, expected] of Object.entries(verifications)) {
            let actual: any;
            switch (key) {
              case 'fen':
                actual = currentFen;
                if (expected instanceof RegExp) {
                  results[key] = expected.test(actual);
                } else {
                  results[key] = actual === expected;
                }
                break;
              case 'turn':
                // Get fresh state for turn verification
                actual = useUnifiedGameStore.getState().currentTurn;
                results[key] = actual === expected;
                break;
              case 'phase':
                // Get fresh state for phase verification
                actual = useUnifiedGameStore.getState().phase;
                console.log(`[Test] Verifying phase: expected="${expected}", actual="${actual}"`);
                results[key] = actual === expected;
                break;
              case 'bannedMove':
                // Get fresh state for bannedMove verification
                actual = useUnifiedGameStore.getState().currentBannedMove;
                console.log(`[Test] Verifying bannedMove: expected=${JSON.stringify(expected)}, actual=${JSON.stringify(actual)}`);
                if (!expected) {
                  results[key] = actual === null;
                } else {
                  // Check if both from and to match
                  const expectedMove = expected as {from: string, to: string};
                  const actualMove = actual as any;
                  const matches = actualMove && actualMove.from === expectedMove.from && actualMove.to === expectedMove.to;
                  console.log(`[Test] BannedMove comparison: from match=${actualMove?.from === expectedMove.from}, to match=${actualMove?.to === expectedMove.to}, overall=${matches}`);
                  results[key] = matches;
                }
                break;
              case 'checkmate':
                actual = chess?.inCheckmate();
                results[key] = actual === expected;
                break;
              case 'stalemate':
                actual = chess?.inStalemate();
                results[key] = actual === expected;
                break;
              case 'gameOver':
                actual = chess?.gameOver();
                results[key] = actual === expected;
                break;
              case 'banCount':
                // Get fresh state for banCount verification
                actual = useUnifiedGameStore.getState().banHistory?.length || 0;
                console.log(`[Test] Verifying banCount: expected=${expected}, actual=${actual}`);
                results[key] = actual === expected;
                break;
              case 'moveCount':
                // Get fresh state for moveCount verification
                const currentMoveHistory = useUnifiedGameStore.getState().moveHistory;
                actual = currentMoveHistory?.length || 0;
                console.log(`[Test] Verifying moveCount: expected=${expected}, actual=${actual}`);
                results[key] = actual === expected;
                break;
              default:
                results[key] = false;
            }
          }
          
          const allPassed = Object.values(results).every(r => r === true);
          return {
            success: allPassed,
            message: allPassed ? 'All verifications passed' : `Verification failed: ${JSON.stringify(results)}`,
            data: results
          };

        case 'wait':
          await new Promise(resolve => setTimeout(resolve, step.data?.duration || 100));
          return { success: true, message: `Waited ${step.data?.duration || 100}ms` };

        case 'custom':
          const customResult = await runCustomAction(step.data);
          return customResult;

        default:
          return { success: false, message: `Unknown step type: ${step.type}` };
      }
    } catch (error) {
      return { success: false, message: `Step error: ${error.message}` };
    }
  };

  const runCustomAction = async (data: any): Promise<{ success: boolean; message?: string; data?: any }> => {
    switch (data.action) {
      case 'tryIllegalMove':
        try {
          const result = store.executeMove(data.from, data.to);
          return { success: !result, message: result ? 'Move was allowed (unexpected)' : 'Illegal move rejected' };
        } catch {
          return { success: true, message: 'Illegal move properly rejected' };
        }

      case 'setupPromotion':
        store.setupTestPosition('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
        return { success: true, message: 'Promotion position set up' };

      case 'setupCheckmate':
        store.setupTestPosition('r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4');
        return { success: true, message: 'Checkmate position set up' };

      case 'setupStalemate':
        store.setupTestPosition('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
        return { success: true, message: 'Stalemate position set up' };

      case 'performanceTest':
        const startTime = Date.now();
        const operations = data.operations || 100;
        
        for (let i = 0; i < operations; i++) {
          store.initLocalGame();
          store.getLegalMoves();
          store.getPossibleBans();
        }
        
        const duration = Date.now() - startTime;
        const success = duration < (data.threshold || 1000);
        
        return {
          success,
          message: `${operations} operations in ${duration}ms`,
          data: { duration, operationsPerSecond: (operations / duration) * 1000 }
        };

      default:
        return { success: false, message: `Unknown custom action: ${data.action}` };
    }
  };

  const runTest = async (scenario: TestScenario) => {
    setCurrentTest(scenario.id);
    const startTime = Date.now();
    
    const result = addTestResult({
      name: scenario.name,
      status: 'running',
      message: 'Test in progress...'
    });

    addLog(`Starting test: ${scenario.name}`, 'info');

    let allStepsPassed = true;
    const stepResults: any[] = [];

    for (let i = 0; i < scenario.steps.length; i++) {
      const step = scenario.steps[i];
      addLog(`Step ${i + 1}: ${step.description || step.type}`, 'info');
      
      const stepResult = await runTestStep(step);
      stepResults.push(stepResult);
      
      if (!stepResult.success) {
        allStepsPassed = false;
        addLog(`Step ${i + 1} failed: ${stepResult.message}`, 'error');
        break;
      } else {
        addLog(`Step ${i + 1} passed: ${stepResult.message}`, 'success');
      }
    }

    const duration = Date.now() - startTime;

    setTestResults(prev => prev.map(r => 
      r.id === result.id 
        ? {
            ...r,
            status: allStepsPassed ? 'passed' : 'failed',
            message: allStepsPassed 
              ? `Test passed in ${duration}ms` 
              : `Test failed: ${stepResults.find(r => !r.success)?.message}`,
            duration,
            details: { stepResults, scenario }
          }
        : r
    ));

    addLog(
      `Test ${scenario.name} ${allStepsPassed ? 'PASSED' : 'FAILED'} in ${duration}ms`,
      allStepsPassed ? 'success' : 'error'
    );

    setCurrentTest(null);
    return allStepsPassed;
  };

  const runAllTests = async () => {
    setIsRunning(true);
    addLog('Starting test suite...', 'info');
    
    const testsToRun = selectedCategory === 'all' 
      ? testScenarios 
      : testScenarios.filter(t => t.category === selectedCategory);

    let passedCount = 0;
    let failedCount = 0;

    for (const scenario of testsToRun) {
      const passed = await runTest(scenario);
      if (passed) passedCount++;
      else failedCount++;

      if (!autoMode && !passed) {
        break;
      }
    }

    addLog(`Test suite complete: ${passedCount} passed, ${failedCount} failed`, 
      failedCount === 0 ? 'success' : 'warning');
    
    setIsRunning(false);
  };

  const clearResults = () => {
    setTestResults([]);
    setLogs([]);
    setExpandedTests(new Set());
  };

  const filteredResults = showOnlyFailed 
    ? testResults.filter(r => r.status === 'failed')
    : testResults;

  const stats = {
    total: testResults.length,
    passed: testResults.filter(r => r.status === 'passed').length,
    failed: testResults.filter(r => r.status === 'failed').length,
    running: testResults.filter(r => r.status === 'running').length,
    pending: testResults.filter(r => r.status === 'pending').length
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ mt: 3, mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Science /> Game Logic Test Suite
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Test Controls</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {stats.total > 0 && (
                    <>
                      <Chip label={`Total: ${stats.total}`} />
                      <Chip label={`Passed: ${stats.passed}`} color="success" />
                      <Chip label={`Failed: ${stats.failed}`} color="error" />
                    </>
                  )}
                </Box>
              </Box>

              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Category</InputLabel>
                    <Select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      label="Category"
                    >
                      <MenuItem value="all">All Tests</MenuItem>
                      <MenuItem value="move">Move Tests</MenuItem>
                      <MenuItem value="ban">Ban Tests</MenuItem>
                      <MenuItem value="state">State Tests</MenuItem>
                      <MenuItem value="integration">Integration</MenuItem>
                      <MenuItem value="performance">Performance</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Test Speed (ms)"
                    type="number"
                    value={testSpeed}
                    onChange={(e) => setTestSpeed(Number(e.target.value))}
                    InputProps={{ inputProps: { min: 0, max: 1000 } }}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={autoMode}
                        onChange={(e) => setAutoMode(e.target.checked)}
                      />
                    }
                    label="Auto Mode"
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showOnlyFailed}
                        onChange={(e) => setShowOnlyFailed(e.target.checked)}
                      />
                    }
                    label="Failed Only"
                  />
                </Grid>
              </Grid>

              <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<PlayArrow />}
                  onClick={runAllTests}
                  disabled={isRunning}
                >
                  Run All Tests
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  startIcon={<Stop />}
                  onClick={() => setIsRunning(false)}
                  disabled={!isRunning}
                >
                  Stop
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={clearResults}
                >
                  Clear Results
                </Button>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="h6" gutterBottom>Available Test Scenarios</Typography>
              
              <Grid container spacing={2}>
                {testScenarios.map((scenario) => (
                  <Grid item xs={12} sm={6} md={4} key={scenario.id}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle1" fontWeight="bold">
                          {scenario.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {scenario.description}
                        </Typography>
                        <Chip 
                          label={scenario.category} 
                          size="small" 
                          color="primary" 
                          variant="outlined" 
                        />
                      </CardContent>
                      <CardActions>
                        <Button
                          size="small"
                          onClick={() => runTest(scenario)}
                          disabled={isRunning}
                          startIcon={<PlayArrow />}
                        >
                          Run Test
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" gutterBottom>Current Game State</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="body2">
                  <strong>Phase:</strong> {phase || 'Not initialized'}
                </Typography>
                <Typography variant="body2">
                  <strong>Turn:</strong> {currentTurn || 'N/A'}
                </Typography>
                <Typography variant="body2">
                  <strong>FEN:</strong> 
                  <Box component="span" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    {currentFen ? currentFen.substring(0, 30) + '...' : 'N/A'}
                  </Box>
                </Typography>
                {currentBannedMove && (
                  <Alert severity="warning" sx={{ py: 0.5 }}>
                    Banned: {currentBannedMove.from}-{currentBannedMove.to}
                  </Alert>
                )}
                <Typography variant="body2">
                  <strong>Move Count:</strong> {moveHistory?.length || 0}
                </Typography>
                <Typography variant="body2">
                  <strong>Ban Count:</strong> {store.banHistory?.length || 0}
                </Typography>
              </Box>
            </Paper>

            <Paper sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
              <Typography variant="h6" gutterBottom>Test Logs</Typography>
              <Box sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                {logs.map((log, index) => (
                  <Box
                    key={index}
                    sx={{
                      py: 0.5,
                      color: log.includes('❌') ? 'error.main' : 
                             log.includes('⚠️') ? 'warning.main' :
                             log.includes('✅') ? 'success.main' : 'text.primary',
                      borderBottom: '1px solid',
                      borderColor: 'divider'
                    }}
                  >
                    {log}
                  </Box>
                ))}
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>Test Results</Typography>
              
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell width={40}></TableCell>
                      <TableCell>Test Name</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Duration</TableCell>
                      <TableCell>Message</TableCell>
                      <TableCell>Time</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredResults.map((result) => (
                      <>
                        <TableRow key={result.id}>
                          <TableCell>
                            <IconButton
                              size="small"
                              onClick={() => {
                                const newExpanded = new Set(expandedTests);
                                if (newExpanded.has(result.id)) {
                                  newExpanded.delete(result.id);
                                } else {
                                  newExpanded.add(result.id);
                                }
                                setExpandedTests(newExpanded);
                              }}
                            >
                              {expandedTests.has(result.id) ? <ExpandLess /> : <ExpandMore />}
                            </IconButton>
                          </TableCell>
                          <TableCell>{result.name}</TableCell>
                          <TableCell>
                            <Chip
                              label={result.status}
                              size="small"
                              color={
                                result.status === 'passed' ? 'success' :
                                result.status === 'failed' ? 'error' :
                                result.status === 'running' ? 'info' :
                                result.status === 'warning' ? 'warning' :
                                'default'
                              }
                              icon={
                                result.status === 'passed' ? <CheckCircle /> :
                                result.status === 'failed' ? <ErrorIcon /> :
                                result.status === 'warning' ? <Warning /> :
                                undefined
                              }
                            />
                          </TableCell>
                          <TableCell>{result.duration ? `${result.duration}ms` : '-'}</TableCell>
                          <TableCell>{result.message}</TableCell>
                          <TableCell>
                            {result.timestamp.toLocaleTimeString()}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={6} sx={{ py: 0 }}>
                            <Collapse in={expandedTests.has(result.id)} timeout="auto" unmountOnExit>
                              <Box sx={{ p: 2, bgcolor: 'background.default' }}>
                                <Typography variant="subtitle2" gutterBottom>Test Details</Typography>
                                <pre style={{ fontSize: '0.75rem', overflow: 'auto' }}>
                                  {JSON.stringify(result.details, null, 2)}
                                </pre>
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
}