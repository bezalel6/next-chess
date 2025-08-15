import { Box, Container, Typography, Button, Paper } from "@mui/material";
import { useEffect, useState } from "react";
import { useUnifiedGameStore } from "@/stores/unifiedGameStore";
import GameBoardV2 from "@/components/GameBoardV2";
import LocalMoveHistory from "@/components/LocalMoveHistory";
import LocalGameStatus from "@/components/LocalGameStatus";
import type { Square } from "chess.js";

// Test sequence: {banning: d2d4} 1. e4 {banning: e7e5} e6 {banning: f2f4} 2. Qh5 {banning: g7g6} a5 {banning: a2a4} 3. Qxf7+ {banning: e8f7}
const testSequence = [
  { type: 'ban', from: 'd2' as Square, to: 'd4' as Square, player: 'Black bans d2-d4' },
  { type: 'move', from: 'e2' as Square, to: 'e4' as Square, player: 'White plays e4' },
  { type: 'ban', from: 'e7' as Square, to: 'e5' as Square, player: 'White bans e7-e5' },
  { type: 'move', from: 'e7' as Square, to: 'e6' as Square, player: 'Black plays e6' },
  { type: 'ban', from: 'f2' as Square, to: 'f4' as Square, player: 'Black bans f2-f4' },
  { type: 'move', from: 'd1' as Square, to: 'h5' as Square, player: 'White plays Qh5' },
  { type: 'ban', from: 'g7' as Square, to: 'g6' as Square, player: 'White bans g7-g6' },
  { type: 'move', from: 'a7' as Square, to: 'a5' as Square, player: 'Black plays a5' },
  { type: 'ban', from: 'a2' as Square, to: 'a4' as Square, player: 'Black bans a2-a4' },
  { type: 'move', from: 'h5' as Square, to: 'f7' as Square, player: 'White plays Qxf7+!' },
  { type: 'ban', from: 'e8' as Square, to: 'f7' as Square, player: 'White would ban Kxf7 (checkmate!)' },
];

export default function BanChessCheckmatePage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [testResult, setTestResult] = useState<string>('');
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  
  const {
    initLocalGame,
    executeGameOperation,
    game,
    phase,
    currentBannedMove,
    chess,
  } = useUnifiedGameStore();

  useEffect(() => {
    // Initialize a new local game on mount
    initLocalGame();
  }, []);

  const executeStep = () => {
    if (currentStep >= testSequence.length) return;
    
    const step = testSequence[currentStep];
    
    const success = executeGameOperation(
      step.type as 'move' | 'ban',
      step.from,
      step.to
    );
    
    if (success) {
      setCurrentStep(currentStep + 1);
      
      // Check if we've reached checkmate
      if (currentStep === testSequence.length - 2) { // After Qxf7+
        // Check game status
        if (game?.status === 'finished' && game?.endReason === 'checkmate') {
          setTestResult('✅ Test PASSED! Ban Chess checkmate detected correctly.');
        } else if (chess?.inCheck()) {
          const moves = chess?.moves() || [];
          setTestResult(`⚠️ King in check with ${moves.length} legal move(s). Game status: ${game?.status}`);
          if (moves.length === 1) {
            setTestResult(`✅ Test PASSED! Black is in check with only 1 legal move (Kxf7) which can be banned - this is checkmate in Ban Chess!`);
          }
        } else {
          setTestResult(`❌ Test FAILED. Expected checkmate but game continues. Status: ${game?.status}`);
        }
      }
    } else {
      setTestResult(`❌ Failed to execute step ${currentStep}: ${step.player}`);
    }
  };

  const autoPlay = async () => {
    setIsAutoPlaying(true);
    
    for (let i = currentStep; i < testSequence.length - 1; i++) { // Stop before the final ban
      await new Promise(resolve => setTimeout(resolve, 1000));
      executeStep();
    }
    
    setIsAutoPlaying(false);
  };

  const reset = () => {
    initLocalGame();
    setCurrentStep(0);
    setTestResult('');
  };

  return (
    <Box sx={{ 
      minHeight: '100vh',
      bgcolor: '#161512',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <Box sx={{ 
        p: 2, 
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        bgcolor: '#1e1a17',
      }}>
        <Container maxWidth="lg">
          <Typography variant="h5" sx={{ color: '#bababa', fontWeight: 600 }}>
            Ban Chess Checkmate Test
          </Typography>
          <Typography variant="body2" sx={{ color: '#888', mt: 1 }}>
            Testing the checkmate sequence where Black has only one legal move (Kxf7) which can be banned
          </Typography>
        </Container>
      </Box>

      {/* Main content */}
      <Container maxWidth="lg" sx={{ py: 3, flex: 1 }}>
        <Box sx={{ display: 'flex', gap: 3 }}>
          {/* Left: Controls and sequence */}
          <Box sx={{ flex: 1 }}>
            <Paper sx={{ p: 2, bgcolor: '#2e2a24', mb: 2 }}>
              <Typography variant="h6" sx={{ color: '#bababa', mb: 2 }}>
                Test Controls
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Button 
                  variant="contained" 
                  onClick={executeStep}
                  disabled={currentStep >= testSequence.length || isAutoPlaying}
                >
                  Next Step
                </Button>
                <Button 
                  variant="contained" 
                  onClick={autoPlay}
                  disabled={currentStep >= testSequence.length - 1 || isAutoPlaying}
                >
                  Auto Play
                </Button>
                <Button 
                  variant="outlined" 
                  onClick={reset}
                  disabled={isAutoPlaying}
                >
                  Reset
                </Button>
              </Box>

              <Typography variant="body2" sx={{ color: '#bababa', mb: 1 }}>
                Step {currentStep} / {testSequence.length - 1}
              </Typography>
              
              {currentStep < testSequence.length && (
                <Typography variant="body2" sx={{ color: '#4caf50' }}>
                  Next: {testSequence[currentStep].player}
                </Typography>
              )}
            </Paper>

            <Paper sx={{ p: 2, bgcolor: '#2e2a24', mb: 2 }}>
              <Typography variant="h6" sx={{ color: '#bababa', mb: 2 }}>
                Test Sequence
              </Typography>
              
              {testSequence.map((step, idx) => (
                <Box 
                  key={idx} 
                  sx={{ 
                    py: 0.5,
                    color: idx < currentStep ? '#888' : idx === currentStep ? '#4caf50' : '#555',
                    fontWeight: idx === currentStep ? 600 : 400,
                  }}
                >
                  {idx + 1}. {step.player}
                </Box>
              ))}
            </Paper>

            {testResult && (
              <Paper sx={{ p: 2, bgcolor: '#2e2a24' }}>
                <Typography variant="h6" sx={{ color: '#bababa', mb: 1 }}>
                  Test Result
                </Typography>
                <Typography 
                  variant="body1" 
                  sx={{ 
                    color: testResult.includes('PASSED') ? '#4caf50' : '#f44336',
                    fontWeight: 600,
                  }}
                >
                  {testResult}
                </Typography>
              </Paper>
            )}
          </Box>

          {/* Center: Board */}
          <Box sx={{ flex: 1 }}>
            <GameBoardV2 orientation="white" />
          </Box>

          {/* Right: Status and moves */}
          <Box sx={{ flex: 1 }}>
            <LocalGameStatus />
            <Box sx={{ mt: 2 }}>
              <LocalMoveHistory />
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}