import { useEffect, useRef, useState } from 'react';
import { Box, Paper, Typography, TextField, Checkbox, FormControlLabel } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/router';

interface Message {
  text: string;
  timestamp: string;
}

export function TestAgentComms() {
  // Only show in test mode
  if (process.env.NEXT_PUBLIC_USE_TEST_AUTH !== 'true') {
    return null;
  }

  const router = useRouter();
  const [masterMessages, setMasterMessages] = useState<Message[]>([]);
  const [subMessages, setSubMessages] = useState<Message[]>([]);
  const [masterInput, setMasterInput] = useState('');
  const [subInput, setSubInput] = useState('');
  const [isMasterAgent, setIsMasterAgent] = useState(false);
  const [isSubAgent, setIsSubAgent] = useState(false);
  const masterScrollRef = useRef<HTMLDivElement>(null);
  const subScrollRef = useRef<HTMLDivElement>(null);
  
  // Clear messages when page loads with ?clean=true
  useEffect(() => {
    if (router.query.clean === 'true') {
      fetch('/api/test/clear-messages', { method: 'POST' })
        .then(() => {
          setMasterMessages([]);
          setSubMessages([]);
          console.log('[TestAgentComms] Messages cleared due to ?clean=true');
        })
        .catch(err => console.error('[TestAgentComms] Failed to clear messages:', err));
    }
  }, [router.query.clean]);

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
    if (e.key === 'Enter' && !e.shiftKey && masterInput.trim()) {
      e.preventDefault();
      const success = await (window as any).sendMasterMessage(masterInput);
      if (success) {
        setMasterInput('');
      }
    }
  };

  // Handle sub input submission
  const handleSubSubmit = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && subInput.trim()) {
      e.preventDefault();
      const success = await (window as any).sendSubMessage(subInput);
      if (success) {
        setSubInput('');
      }
    }
  };

  const isIdentified = isMasterAgent || isSubAgent;

  return (
    <>
      {/* Visible checkboxes for agent identification */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 145,
          left: 10,
          display: 'flex',
          gap: 2,
          zIndex: 10000,
          bgcolor: 'rgba(0,0,0,0.8)',
          p: 1,
          borderRadius: 1,
          border: '1px solid rgba(255,255,255,0.2)',
        }}
      >
        <FormControlLabel
          control={
            <Checkbox
              checked={isMasterAgent}
              onChange={(e) => {
                setIsMasterAgent(e.target.checked);
                if (e.target.checked) setIsSubAgent(false);
              }}
              data-testid="master-agent-checkbox"
              sx={{
                color: '#0f0',
                '&.Mui-checked': { color: '#0f0' },
                p: 0.5,
              }}
            />
          }
          label="I am Master"
          sx={{
            '& .MuiFormControlLabel-label': {
              fontSize: '11px',
              color: '#0f0',
              fontWeight: isMasterAgent ? 'bold' : 'normal',
            },
            m: 0,
          }}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={isSubAgent}
              onChange={(e) => {
                setIsSubAgent(e.target.checked);
                if (e.target.checked) setIsMasterAgent(false);
              }}
              data-testid="sub-agent-checkbox"
              sx={{
                color: '#00f',
                '&.Mui-checked': { color: '#00f' },
                p: 0.5,
              }}
            />
          }
          label="I am Sub"
          sx={{
            '& .MuiFormControlLabel-label': {
              fontSize: '11px',
              color: '#00f',
              fontWeight: isSubAgent ? 'bold' : 'normal',
            },
            m: 0,
          }}
        />
      </Box>

      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: isIdentified ? '140px' : '120px',
          display: 'flex',
          gap: 1,
          p: 1,
          bgcolor: 'rgba(0,0,0,0.9)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          zIndex: 9999,
          pointerEvents: 'none',
          overflow: 'hidden',
          transition: 'height 0.3s ease',
        }}
      >
        <AnimatePresence mode="wait">
          {!isIdentified ? (
            // Default view: show both panels
            <>
              {/* Master Panel */}
              <motion.div
                key="master-panel-default"
                initial={{ x: 0, opacity: 1 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '-120%', opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeIn' }}
                style={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', gap: '4px' }}
              >
                <Paper
                  ref={masterScrollRef}
                  sx={{
                    flex: 1,
                    bgcolor: 'rgba(0,100,0,0.2)',
                    border: '1px solid rgba(0,255,0,0.3)',
                    overflow: 'auto',
                    p: 1,
                    pt: '2px',
                    pointerEvents: 'auto',
                    position: 'relative',
                  }}
                >
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: '#0f0', 
                      display: 'block', 
                      fontSize: '12px',
                      position: 'absolute',
                      top: '-18px',
                      left: '8px',
                      bgcolor: 'rgba(0,0,0,0.9)',
                      px: 1,
                      borderRadius: '4px 4px 0 0',
                      border: '1px solid rgba(0,255,0,0.3)',
                      borderBottom: 'none',
                    }}
                  >
                    MASTER AGENT
                  </Typography>
                  {masterMessages.filter(msg => msg.text !== '__CLEAR__').map((msg, i) => (
                    <Typography key={i} variant="caption" sx={{ color: '#8f8', display: 'block', fontSize: '10px', lineHeight: 1.2, fontFamily: 'monospace' }}>
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
                    width: '100%',
                    '& .MuiInputBase-input': { fontSize: '10px', py: 0.5, color: '#0f0', fontFamily: 'monospace' },
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

              {/* Sub Panel */}
              <motion.div
                key="sub-panel-default"
                initial={{ x: 0, opacity: 1 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '120%', opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeIn' }}
                style={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', gap: '4px' }}
              >
                <Paper
                  ref={subScrollRef}
                  sx={{
                    flex: 1,
                    bgcolor: 'rgba(0,0,100,0.2)',
                    border: '1px solid rgba(0,100,255,0.3)',
                    overflow: 'auto',
                    p: 1,
                    pt: '2px',
                    pointerEvents: 'auto',
                    position: 'relative',
                  }}
                >
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: '#00f', 
                      display: 'block', 
                      fontSize: '12px',
                      position: 'absolute',
                      top: '-18px',
                      left: '8px',
                      bgcolor: 'rgba(0,0,0,0.9)',
                      px: 1,
                      borderRadius: '4px 4px 0 0',
                      border: '1px solid rgba(0,100,255,0.3)',
                      borderBottom: 'none',
                    }}
                  >
                    SUB AGENT
                  </Typography>
                  {subMessages.filter(msg => msg.text !== '__CLEAR__').map((msg, i) => (
                    <Typography key={i} variant="caption" sx={{ color: '#88f', display: 'block', fontSize: '10px', lineHeight: 1.2, fontFamily: 'monospace' }}>
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
                    width: '100%',
                    '& .MuiInputBase-input': { fontSize: '10px', py: 0.5, color: '#00f', fontFamily: 'monospace' },
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
            </>
          ) : (
            // Identified view: criss-cross horizontal animation
            <motion.div
              key={`identified-container-${isMasterAgent ? 'master' : 'sub'}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.1 }}
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '4px',
                width: '100%',
                height: '100%',
                position: 'relative',
              }}
            >
              {/* Incoming Messages - slides from left */}
              <motion.div
                initial={{ 
                  x: '-100%', 
                  opacity: 0,
                  height: '60%'
                }}
                animate={{ 
                  x: 0, 
                  opacity: 1,
                  height: '100%'
                }}
                transition={{ 
                  duration: 0.35,
                  ease: [0.22, 0.61, 0.36, 1],
                  delay: 0.15,
                }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
              >
                <Paper
                  ref={isMasterAgent ? subScrollRef : masterScrollRef}
                  sx={{
                    flex: 1,
                    bgcolor: isMasterAgent ? 'rgba(0,0,100,0.2)' : 'rgba(0,100,0,0.2)',
                    border: isMasterAgent ? '1px solid rgba(0,100,255,0.3)' : '1px solid rgba(0,255,0,0.3)',
                    overflow: 'auto',
                    p: 1,
                    pt: '2px',
                    pointerEvents: 'auto',
                    position: 'relative',
                  }}
                >
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: isMasterAgent ? '#00f' : '#0f0',
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      position: 'absolute',
                      top: '-20px',
                      left: '8px',
                      bgcolor: 'rgba(0,0,0,0.9)',
                      px: 1,
                      borderRadius: '4px 4px 0 0',
                      border: isMasterAgent ? '1px solid rgba(0,100,255,0.3)' : '1px solid rgba(0,255,0,0.3)',
                      borderBottom: 'none',
                    }}
                  >
                    INCOMING FROM {isMasterAgent ? 'SUB' : 'MASTER'}
                  </Typography>
                  {(isMasterAgent ? subMessages : masterMessages)
                    .filter(msg => msg.text !== '__CLEAR__')
                    .map((msg, i) => (
                      <Typography
                        key={i}
                        variant="caption"
                        sx={{
                          color: isMasterAgent ? '#88f' : '#8f8',
                          display: 'block',
                          fontSize: '13px',
                          lineHeight: 1.4,
                          fontFamily: 'monospace',
                        }}
                      >
                        [{new Date(msg.timestamp).toLocaleTimeString()}] {msg.text}
                      </Typography>
                    ))}
                </Paper>
              </motion.div>

              {/* Own Input - slides from right */}
              <motion.div
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ 
                  duration: 0.35,
                  ease: [0.22, 0.61, 0.36, 1],
                  delay: 0.15,
                }}
              >
                <TextField
                  value={isMasterAgent ? masterInput : subInput}
                  onChange={(e) => isMasterAgent ? setMasterInput(e.target.value) : setSubInput(e.target.value)}
                  onKeyDown={isMasterAgent ? handleMasterSubmit : handleSubSubmit}
                  placeholder={`Send as ${isMasterAgent ? 'Master' : 'Sub'} (Enter to send, Shift+Enter for new line)`}
                  size="small"
                  multiline
                  rows={1}
                  data-testid={isMasterAgent ? "master-message-input" : "sub-message-input"}
                  sx={{
                    width: '100%',
                    '& .MuiInputBase-input': {
                      fontSize: '12px',
                      color: isMasterAgent ? '#0f0' : '#00f',
                      fontFamily: 'monospace',
                    },
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: isMasterAgent ? 'rgba(0,50,0,0.3)' : 'rgba(0,0,50,0.3)',
                      '& fieldset': { 
                        borderColor: isMasterAgent ? 'rgba(0,255,0,0.5)' : 'rgba(0,100,255,0.5)'
                      },
                      '&:hover fieldset': { 
                        borderColor: isMasterAgent ? 'rgba(0,255,0,0.7)' : 'rgba(0,100,255,0.7)'
                      },
                      '&.Mui-focused fieldset': { 
                        borderColor: isMasterAgent ? '#0f0' : '#00f'
                      },
                    },
                    pointerEvents: 'auto',
                  }}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
    </>
  );
}