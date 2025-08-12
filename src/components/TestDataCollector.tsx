import { useEffect, useState } from 'react';
import { Box, TextField, Typography, Paper } from '@mui/material';

interface TestData {
  type: 'selector_success' | 'selector_failure' | 'timing_adjustment' | 'flow_complete' | 'error_recovery';
  data: any;
  timestamp: string;
}

export function TestDataCollector() {
  // Only show in test mode
  if (process.env.NEXT_PUBLIC_USE_TEST_AUTH !== 'true') {
    return null;
  }

  const [dataInput, setDataInput] = useState('');
  const [submittedData, setSubmittedData] = useState<TestData[]>([]);

  // Load existing test data on mount
  useEffect(() => {
    const loadTestData = async () => {
      try {
        const response = await fetch('/api/test/get-test-data');
        if (response.ok) {
          const data = await response.json();
          setSubmittedData(data.recent || []);
        }
      } catch (error) {
        console.error('Failed to load test data:', error);
      }
    };
    loadTestData();
  }, []);

  // Handle data submission via text input
  const handleDataSubmit = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && dataInput.trim()) {
      e.preventDefault();
      
      try {
        // Parse the input as a command
        const parts = dataInput.trim().split(':');
        const command = parts[0].toLowerCase();
        const payload = parts.slice(1).join(':').trim();

        let testData: TestData | null = null;

        // Process different command types
        switch (command) {
          case 'selector_success':
          case 'ss': {
            // Format: ss:selector_name:selector_value:context
            const [name, selector, context] = payload.split(':').map(s => s.trim());
            testData = {
              type: 'selector_success',
              data: { name, selector, context, success: true },
              timestamp: new Date().toISOString()
            };
            break;
          }
          
          case 'selector_fail':
          case 'sf': {
            // Format: sf:selector_name:selector_value:error
            const [name, selector, error] = payload.split(':').map(s => s.trim());
            testData = {
              type: 'selector_failure',
              data: { name, selector, error },
              timestamp: new Date().toISOString()
            };
            break;
          }
          
          case 'timing':
          case 't': {
            // Format: t:operation:duration_ms
            const [operation, duration] = payload.split(':').map(s => s.trim());
            testData = {
              type: 'timing_adjustment',
              data: { operation, duration_ms: parseInt(duration) || 0 },
              timestamp: new Date().toISOString()
            };
            break;
          }
          
          case 'flow':
          case 'f': {
            // Format: f:flow_name:success:duration_ms
            const [flowName, success, duration] = payload.split(':').map(s => s.trim());
            testData = {
              type: 'flow_complete',
              data: { 
                flowName, 
                success: success === 'true' || success === '1',
                duration_ms: parseInt(duration) || 0
              },
              timestamp: new Date().toISOString()
            };
            break;
          }
          
          case 'error':
          case 'e': {
            // Format: e:error_type:recovery_strategy:success
            const [errorType, strategy, success] = payload.split(':').map(s => s.trim());
            testData = {
              type: 'error_recovery',
              data: { 
                errorType, 
                strategy,
                success: success === 'true' || success === '1'
              },
              timestamp: new Date().toISOString()
            };
            break;
          }
          
          case 'raw':
          case 'r': {
            // Format: r:json_data
            try {
              const jsonData = JSON.parse(payload);
              testData = {
                type: jsonData.type || 'selector_success',
                data: jsonData.data || jsonData,
                timestamp: new Date().toISOString()
              };
            } catch {
              console.error('Invalid JSON in raw command');
            }
            break;
          }
        }

        if (testData) {
          // Send to backend
          const response = await fetch('/api/test/submit-test-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testData)
          });

          if (response.ok) {
            // Update local display
            setSubmittedData(prev => [testData!, ...prev].slice(0, 10));
            setDataInput('');
            
            // Also update the testing memory file
            await updateTestingMemory(testData);
          }
        }
      } catch (error) {
        console.error('Failed to submit test data:', error);
      }
    }
  };

  // Update the testing memory JSON file
  const updateTestingMemory = async (data: TestData) => {
    try {
      const response = await fetch('/api/test/update-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  // Expose global function for agents to submit data
  useEffect(() => {
    (window as any).submitTestData = async (command: string) => {
      // Simulate entering the command and pressing Enter
      const input = document.querySelector('[data-testid="test-data-input"]') as HTMLInputElement;
      if (input) {
        input.value = command;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        const enterEvent = new KeyboardEvent('keydown', { 
          key: 'Enter', 
          code: 'Enter', 
          keyCode: 13,
          bubbles: true 
        });
        input.dispatchEvent(enterEvent);
        return true;
      }
      return false;
    };

    return () => {
      delete (window as any).submitTestData;
    };
  }, []);

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 60,
        right: 10,
        width: '300px',
        maxHeight: '200px',
        bgcolor: 'rgba(0,0,0,0.9)',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 1,
        p: 1,
        zIndex: 9998,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <Typography variant="caption" sx={{ color: '#ff0', fontWeight: 'bold' }}>
        TEST DATA COLLECTOR
      </Typography>
      
      <TextField
        value={dataInput}
        onChange={(e) => setDataInput(e.target.value)}
        onKeyDown={handleDataSubmit}
        placeholder="ss:name:selector:context | sf:name:selector:error | t:op:ms | f:flow:success:ms | e:error:strategy:success"
        size="small"
        data-testid="test-data-input"
        sx={{
          '& .MuiInputBase-input': {
            fontSize: '10px',
            py: 0.5,
            color: '#fff',
            fontFamily: 'monospace',
          },
          '& .MuiOutlinedInput-root': {
            backgroundColor: 'rgba(50,50,50,0.5)',
            '& fieldset': { borderColor: 'rgba(255,255,0,0.3)' },
            '&:hover fieldset': { borderColor: 'rgba(255,255,0,0.5)' },
            '&.Mui-focused fieldset': { borderColor: '#ff0' },
          },
        }}
      />

      <Paper
        sx={{
          flex: 1,
          overflow: 'auto',
          bgcolor: 'rgba(30,30,30,0.5)',
          p: 0.5,
          maxHeight: '100px',
        }}
      >
        <Typography variant="caption" sx={{ color: '#888', fontSize: '9px' }}>
          Commands: ss (selector success), sf (selector fail), t (timing), f (flow), e (error), r (raw JSON)
        </Typography>
        {submittedData.map((item, i) => (
          <Typography
            key={i}
            variant="caption"
            sx={{
              display: 'block',
              fontSize: '9px',
              color: item.type === 'selector_failure' || item.type === 'error_recovery' ? '#f88' : '#8f8',
              fontFamily: 'monospace',
              lineHeight: 1.2,
            }}
          >
            [{new Date(item.timestamp).toLocaleTimeString()}] {item.type}: {JSON.stringify(item.data).slice(0, 50)}...
          </Typography>
        ))}
      </Paper>
    </Box>
  );
}