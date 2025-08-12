import { useEffect, useRef, useState } from 'react';
import { Box, Paper, Typography, TextField } from '@mui/material';

interface Message {
  text: string;
  timestamp: string;
}

export function TestAgentComms() {
  // Only show in test mode
  if (process.env.NEXT_PUBLIC_USE_TEST_AUTH !== 'true') {
    return null;
  }

  const [masterMessages, setMasterMessages] = useState<Message[]>([]);
  const [subMessages, setSubMessages] = useState<Message[]>([]);
  const [masterInput, setMasterInput] = useState('');
  const [subInput, setSubInput] = useState('');
  const masterScrollRef = useRef<HTMLDivElement>(null);
  const subScrollRef = useRef<HTMLDivElement>(null);

  // Fetch messages periodically
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        // Fetch master messages
        const masterRes = await fetch('/master-messages.json?' + Date.now());
        if (masterRes.ok) {
          const data = await masterRes.json();
          setMasterMessages(data);
        }
      } catch {}

      try {
        // Fetch sub messages
        const subRes = await fetch('/sub-messages.json?' + Date.now());
        if (subRes.ok) {
          const data = await subRes.json();
          setSubMessages(data);
        }
      } catch {}
    };

    // Initial fetch
    fetchMessages();

    // Poll every 500ms
    const interval = setInterval(fetchMessages, 500);

    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (masterScrollRef.current) {
      masterScrollRef.current.scrollTop = masterScrollRef.current.scrollHeight;
    }
  }, [masterMessages]);

  useEffect(() => {
    if (subScrollRef.current) {
      subScrollRef.current.scrollTop = subScrollRef.current.scrollHeight;
    }
  }, [subMessages]);

  // Expose global functions for agents to send messages
  useEffect(() => {
    // Function for master agent to send message
    (window as any).sendMasterMessage = async (text: string) => {
      try {
        const response = await fetch('/api/test/send-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent: 'master', message: text })
        });
        return response.ok;
      } catch {
        return false;
      }
    };

    // Function for sub agent to send message
    (window as any).sendSubMessage = async (text: string) => {
      try {
        const response = await fetch('/api/test/send-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent: 'sub', message: text })
        });
        return response.ok;
      } catch {
        return false;
      }
    };

    // Function to clear all messages
    (window as any).clearAgentMessages = async () => {
      try {
        // Clear master messages
        await fetch('/api/test/send-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent: 'master', message: '__CLEAR__' })
        });
        
        // Clear sub messages
        await fetch('/api/test/send-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent: 'sub', message: '__CLEAR__' })
        });
        
        setMasterMessages([]);
        setSubMessages([]);
        return true;
      } catch {
        return false;
      }
    };

    return () => {
      delete (window as any).sendMasterMessage;
      delete (window as any).sendSubMessage;
      delete (window as any).clearAgentMessages;
    };
  }, []);

  // Handle master input submission
  const handleMasterSubmit = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && masterInput.trim()) {
      e.preventDefault();
      const success = await (window as any).sendMasterMessage(masterInput);
      if (success) {
        setMasterInput('');
      }
    }
  };

  // Handle sub input submission
  const handleSubSubmit = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && subInput.trim()) {
      e.preventDefault();
      const success = await (window as any).sendSubMessage(subInput);
      if (success) {
        setSubInput('');
      }
    }
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '120px',
        display: 'flex',
        gap: 1,
        p: 1,
        bgcolor: 'rgba(0,0,0,0.9)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        zIndex: 9999,
        pointerEvents: 'none', // Don't interfere with page interaction
      }}
    >
      {/* Master Agent Messages */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Paper
          ref={masterScrollRef}
          sx={{
            flex: 1,
            bgcolor: 'rgba(0,100,0,0.2)',
            border: '1px solid rgba(0,255,0,0.3)',
            overflow: 'auto',
            p: 1,
            pointerEvents: 'auto',
          }}
        >
          <Typography variant="caption" sx={{ color: '#0f0', display: 'block', mb: 0.5 }}>
            MASTER AGENT
          </Typography>
          {masterMessages.filter(msg => msg.text !== '__CLEAR__').map((msg, i) => (
            <Typography
              key={i}
              variant="caption"
              sx={{
                color: '#8f8',
                display: 'block',
                fontSize: '10px',
                lineHeight: 1.2,
                fontFamily: 'monospace',
              }}
            >
              [{new Date(msg.timestamp).toLocaleTimeString()}] {msg.text}
            </Typography>
          ))}
        </Paper>
        <TextField
          value={masterInput}
          onChange={(e) => setMasterInput(e.target.value)}
          onKeyDown={handleMasterSubmit}
          placeholder="Type and press Enter to send as Master"
          size="small"
          data-testid="master-message-input"
          sx={{
            '& .MuiInputBase-input': {
              fontSize: '10px',
              py: 0.5,
              color: '#0f0',
              fontFamily: 'monospace',
            },
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'rgba(0,50,0,0.3)',
              '& fieldset': { borderColor: 'rgba(0,255,0,0.3)' },
              '&:hover fieldset': { borderColor: 'rgba(0,255,0,0.5)' },
              '&.Mui-focused fieldset': { borderColor: '#0f0' },
            },
            pointerEvents: 'auto',
          }}
        />
      </Box>

      {/* Sub Agent Messages */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Paper
          ref={subScrollRef}
          sx={{
            flex: 1,
            bgcolor: 'rgba(0,0,100,0.2)',
            border: '1px solid rgba(0,100,255,0.3)',
            overflow: 'auto',
            p: 1,
            pointerEvents: 'auto',
          }}
        >
          <Typography variant="caption" sx={{ color: '#00f', display: 'block', mb: 0.5 }}>
            SUB AGENT
          </Typography>
          {subMessages.filter(msg => msg.text !== '__CLEAR__').map((msg, i) => (
            <Typography
              key={i}
              variant="caption"
              sx={{
                color: '#88f',
                display: 'block',
                fontSize: '10px',
                lineHeight: 1.2,
                fontFamily: 'monospace',
              }}
            >
              [{new Date(msg.timestamp).toLocaleTimeString()}] {msg.text}
            </Typography>
          ))}
        </Paper>
        <TextField
          value={subInput}
          onChange={(e) => setSubInput(e.target.value)}
          onKeyDown={handleSubSubmit}
          placeholder="Type and press Enter to send as Sub"
          size="small"
          data-testid="sub-message-input"
          sx={{
            '& .MuiInputBase-input': {
              fontSize: '10px',
              py: 0.5,
              color: '#00f',
              fontFamily: 'monospace',
            },
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'rgba(0,0,50,0.3)',
              '& fieldset': { borderColor: 'rgba(0,100,255,0.3)' },
              '&:hover fieldset': { borderColor: 'rgba(0,100,255,0.5)' },
              '&.Mui-focused fieldset': { borderColor: '#00f' },
            },
            pointerEvents: 'auto',
          }}
        />
      </Box>
    </Box>
  );
}