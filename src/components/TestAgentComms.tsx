import { useEffect, useRef, useState } from 'react';
import { Box, Paper, Typography, TextField, Checkbox } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [isMasterAgent, setIsMasterAgent] = useState(false);
  const [isSubAgent, setIsSubAgent] = useState(false);
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

  // Expose global functions for agents to send messages and identify themselves
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

    // Function for agents to identify themselves
    (window as any).identifyAsMaster = () => {
      setIsMasterAgent(true);
      const checkbox = document.querySelector('[data-agent-id="master"]') as HTMLInputElement;
      if (checkbox) checkbox.checked = true;
    };

    (window as any).identifyAsSub = () => {
      setIsSubAgent(true);
      const checkbox = document.querySelector('[data-agent-id="sub"]') as HTMLInputElement;
      if (checkbox) checkbox.checked = true;
    };

    return () => {
      delete (window as any).sendMasterMessage;
      delete (window as any).sendSubMessage;
      delete (window as any).clearAgentMessages;
      delete (window as any).identifyAsMaster;
      delete (window as any).identifyAsSub;
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

  // Determine what to show based on agent identification
  const showMasterPanel = !isSubAgent;
  const showSubPanel = !isMasterAgent;
  const isFullWidth = isMasterAgent || isSubAgent;

  return (
    <>
      {/* Hidden checkboxes for agent identification */}
      <Checkbox 
        data-agent-id="master" 
        sx={{ display: 'none' }}
        onChange={(e) => setIsMasterAgent(e.target.checked)}
      />
      <Checkbox 
        data-agent-id="sub" 
        sx={{ display: 'none' }}
        onChange={(e) => setIsSubAgent(e.target.checked)}
      />

      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: isFullWidth ? '140px' : '120px',
          display: 'flex',
          gap: 1,
          p: 1,
          bgcolor: 'rgba(0,0,0,0.9)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          zIndex: 9999,
          pointerEvents: 'none',
          transition: 'height 0.5s ease',
        }}
      >
        <AnimatePresence mode="wait">
          {/* Master Agent Messages */}
          {showMasterPanel && (
            <motion.div
              initial={{ opacity: 1, flex: 1 }}
              animate={{ 
                opacity: 1, 
                flex: isFullWidth ? '1 1 100%' : '1 1 50%',
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
            >
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
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: '#0f0', 
                    display: 'block', 
                    mb: 0.5,
                    fontSize: isFullWidth ? '14px' : '12px',
                    fontWeight: isFullWidth ? 'bold' : 'normal',
                    transition: 'all 0.5s ease',
                  }}
                >
                  {isMasterAgent ? 'YOUR MESSAGES (MASTER)' : 'MASTER AGENT'}
                </Typography>
                {masterMessages.filter(msg => msg.text !== '__CLEAR__').map((msg, i) => (
                  <Typography
                    key={i}
                    variant="caption"
                    sx={{
                      color: '#8f8',
                      display: 'block',
                      fontSize: isFullWidth ? '14px' : '10px',
                      lineHeight: isFullWidth ? 1.4 : 1.2,
                      fontFamily: 'monospace',
                      transition: 'all 0.5s ease',
                    }}
                  >
                    [{new Date(msg.timestamp).toLocaleTimeString()}] {msg.text}
                  </Typography>
                ))}
              </Paper>
              {!isSubAgent && (
                <motion.div
                  initial={{ opacity: 1, height: 'auto' }}
                  animate={{ opacity: isMasterAgent ? 0 : 1, height: isMasterAgent ? 0 : 'auto' }}
                  transition={{ duration: 0.3 }}
                  style={{ overflow: 'hidden' }}
                >
                  <TextField
                    value={masterInput}
                    onChange={(e) => setMasterInput(e.target.value)}
                    onKeyDown={handleMasterSubmit}
                    placeholder="Type and press Enter to send as Master"
                    size="small"
                    data-testid="master-message-input"
                    sx={{
                      width: '100%',
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
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Sub Agent Messages */}
          {showSubPanel && (
            <motion.div
              initial={{ opacity: 1, flex: 1 }}
              animate={{ 
                opacity: 1, 
                flex: isFullWidth ? '1 1 100%' : '1 1 50%',
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
            >
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
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: '#00f', 
                    display: 'block', 
                    mb: 0.5,
                    fontSize: isFullWidth ? '14px' : '12px',
                    fontWeight: isFullWidth ? 'bold' : 'normal',
                    transition: 'all 0.5s ease',
                  }}
                >
                  {isSubAgent ? 'YOUR MESSAGES (SUB)' : 'SUB AGENT'}
                </Typography>
                {subMessages.filter(msg => msg.text !== '__CLEAR__').map((msg, i) => (
                  <Typography
                    key={i}
                    variant="caption"
                    sx={{
                      color: '#88f',
                      display: 'block',
                      fontSize: isFullWidth ? '14px' : '10px',
                      lineHeight: isFullWidth ? 1.4 : 1.2,
                      fontFamily: 'monospace',
                      transition: 'all 0.5s ease',
                    }}
                  >
                    [{new Date(msg.timestamp).toLocaleTimeString()}] {msg.text}
                  </Typography>
                ))}
              </Paper>
              {!isMasterAgent && (
                <motion.div
                  initial={{ opacity: 1, height: 'auto' }}
                  animate={{ opacity: isSubAgent ? 0 : 1, height: isSubAgent ? 0 : 'auto' }}
                  transition={{ duration: 0.3 }}
                  style={{ overflow: 'hidden' }}
                >
                  <TextField
                    value={subInput}
                    onChange={(e) => setSubInput(e.target.value)}
                    onKeyDown={handleSubSubmit}
                    placeholder="Type and press Enter to send as Sub"
                    size="small"
                    data-testid="sub-message-input"
                    sx={{
                      width: '100%',
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
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
    </>
  );
}