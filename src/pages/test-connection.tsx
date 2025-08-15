import { Box, Typography, Button, Stack } from '@mui/material';
import { useState } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../utils/supabase';

const TestConnectionPage = () => {
  const [testResults, setTestResults] = useState<string[]>([]);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testConnection = async () => {
    addResult('Testing Supabase connection...');
    try {
      const { data, error } = await supabase.from('profiles').select('id').limit(1);
      if (error) {
        addResult(`Error: ${error.message}`);
      } else {
        addResult('✅ Supabase connection successful');
      }
    } catch (error) {
      addResult(`❌ Connection failed: ${error}`);
    }
  };

  const testRealtime = async () => {
    addResult('Testing realtime connection...');
    const channel = supabase.channel('test-channel');
    
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        addResult('✅ Realtime connection established');
        setTimeout(() => {
          supabase.removeChannel(channel);
          addResult('Realtime channel cleaned up');
        }, 2000);
      } else if (status === 'CHANNEL_ERROR') {
        addResult('❌ Realtime connection failed');
      } else {
        addResult(`Realtime status: ${status}`);
      }
    });
  };

  const simulateDisconnection = () => {
    addResult('⚠️ Simulating connection issues (check indicator status)');
  };

  return (
    <Layout>
      <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
        <Typography variant="h4" gutterBottom>
          Connection Indicator Test Page
        </Typography>
        
        <Typography variant="body1" paragraph>
          This page helps test the connection indicator functionality. 
          Check the top-left corner for the connection indicator and try the controls below.
        </Typography>

        <Stack spacing={2} sx={{ mb: 4 }}>
          <Button 
            variant="contained" 
            onClick={testConnection}
            color="primary"
          >
            Test Database Connection
          </Button>
          
          <Button 
            variant="contained" 
            onClick={testRealtime}
            color="secondary"
          >
            Test Realtime Connection
          </Button>
          
          <Button 
            variant="outlined" 
            onClick={simulateDisconnection}
            color="warning"
          >
            Simulate Connection Issues
          </Button>
        </Stack>

        {testResults.length > 0 && (
          <Box sx={{ 
            mt: 3, 
            p: 2, 
            bgcolor: 'background.paper', 
            borderRadius: 1,
            fontFamily: 'monospace',
            border: '1px solid',
            borderColor: 'divider'
          }}>
            <Typography variant="h6" gutterBottom color="text.primary">Test Results:</Typography>
            {testResults.map((result, index) => (
              <Typography key={index} variant="body2" sx={{ mb: 0.5, color: 'text.secondary' }}>
                {result}
              </Typography>
            ))}
          </Box>
        )}

        <Box sx={{ mt: 4, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'primary.main' }}>
          <Typography variant="h6" gutterBottom color="text.primary">Connection Indicator Features:</Typography>
          <Typography component="div" variant="body2" color="text.secondary">
            • <strong>Status Icons:</strong> Green checkmark (connected), red error (disconnected), spinning loader (connecting)<br/>
            • <strong>Heartbeat:</strong> Blue pulsing dot when actively pinging server<br/>
            • <strong>Expandable View:</strong> Click to see detailed connection stats<br/>
            • <strong>Real-time Updates:</strong> Connection status updates every 10 seconds<br/>
            • <strong>Ping Times:</strong> Shows round-trip time to server<br/>
            • <strong>Activity Log:</strong> Recent connection events<br/>
            • <strong>User Presence:</strong> Count of active users<br/>
            • <strong>Queue Status:</strong> Shows matchmaking queue position if applicable
          </Typography>
        </Box>
      </Box>
    </Layout>
  );
};

export default TestConnectionPage;