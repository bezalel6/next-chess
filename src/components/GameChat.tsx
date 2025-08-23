import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { KeyboardEvent } from 'react';
import { 
  Box, 
  Typography, 
  TextField,
  IconButton, 
  Chip, 
  Paper,
  Avatar,
  Divider,
  InputAdornment,
  Tooltip,
  Collapse,
  Stack,
  Alert,
} from '@mui/material';
import {
  Send as SendIcon,
  Person as PersonIcon,
  SmartToy as BotIcon,
  Info as InfoIcon,
  ChatBubbleOutline as ChatOnIcon,
  SpeakerNotesOff as ChatOffIcon,
  Timer as TimerIcon,
  CalendarToday as CalendarIcon,
  Block as BlockIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import type { ChatMessageType } from '@/types/chat';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import { useAuth } from '@/contexts/AuthContext';

interface GameChatProps {
  gameId: string;
}

const MAX_MESSAGE_LENGTH = 200;

export default function GameChat({ gameId }: GameChatProps) {
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  
  // Get everything from unified store
  const {
    game,
    messages,
    chatError,
    isTimedOut,
    timeoutSecondsRemaining,
    chatEnabled,
    sendMessage,
    setChatEnabled,
    setChatError,
    checkChatTimeout,
  } = useUnifiedGameStore(s => ({
    game: s.game,
    messages: s.messages,
    chatError: s.chatError,
    isTimedOut: s.isTimedOut,
    timeoutSecondsRemaining: s.timeoutSecondsRemaining,
    chatEnabled: s.chatEnabled,
    sendMessage: s.sendMessage,
    setChatEnabled: s.setChatEnabled,
    setChatError: s.setChatError,
    checkChatTimeout: s.checkChatTimeout,
  }));
  
  // Memoize player info
  const playerInfo = useMemo(() => {
    if (!user || !game) return null;
    const isWhite = game.whitePlayerId === user.id;
    const isBlack = game.blackPlayerId === user.id;
    const isPlayer = isWhite || isBlack;
    return {
      isPlayer,
      color: isWhite ? 'white' : isBlack ? 'black' : 'spectator',
      username: isWhite ? game.whitePlayer : isBlack ? game.blackPlayer : 'Spectator'
    };
  }, [user?.id, game?.whitePlayerId, game?.blackPlayerId, game?.whitePlayer, game?.blackPlayer]);
  
  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // Check timeout status on mount
  useEffect(() => {
    if (gameId !== 'local') {
      checkChatTimeout();
    }
  }, [gameId, checkChatTimeout]);
  
  // Load chat enabled preference from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chess-chat-enabled');
      if (saved !== null) {
        setChatEnabled(saved === 'true');
      }
    }
  }, [setChatEnabled]);
  
  // Update timeout countdown
  useEffect(() => {
    if (!isTimedOut) return;
    
    const interval = setInterval(() => {
      useUnifiedGameStore.getState().updateTimeoutCountdown();
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isTimedOut]);
  
  const handleSendMessage = useCallback(async () => {
    const trimmedInput = inputValue.trim();
    
    // Validation
    if (!trimmedInput || !user || !game || !playerInfo?.isPlayer) return;
    if (trimmedInput.length > MAX_MESSAGE_LENGTH) {
      setChatError(`Message too long (max ${MAX_MESSAGE_LENGTH} characters)`);
      return;
    }
    
    setIsSending(true);
    setChatError(null);
    
    try {
      await sendMessage(trimmedInput);
      setInputValue('');
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  }, [inputValue, user, game, playerInfo, sendMessage, setChatError]);
  
  
  const handleKeyPress = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  const toggleChat = () => {
    setChatEnabled(!chatEnabled);
  };
  
  const getMessageIcon = (type: ChatMessageType) => {
    switch (type) {
      case 'player': return <PersonIcon sx={{ fontSize: 16 }} />;
      case 'system': return <InfoIcon sx={{ fontSize: 16 }} />;
      case 'server': return <BotIcon sx={{ fontSize: 16 }} />;
    }
  };
  
  const getMessageColor = (message: typeof messages[0]) => {
    if (message.type === 'server') {
      if (message.metadata?.eventType === 'game_end') return 'success.main';
      if (message.metadata?.eventType === 'player_left') return 'warning.main';
      return 'info.main';
    }
    if (message.type === 'system') return 'text.secondary';
    if (message.senderId === user?.id) return 'primary.main';
    return 'text.primary';
  };
  
  return (
    <Paper
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.default',
        }}
      >
        {/* Title and Chat Toggle Row */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle2" fontWeight="bold">
              Game Chat
            </Typography>
            {chatEnabled && (
              <Chip 
                label={messages.length} 
                size="small" 
                color="primary"
                variant="outlined"
              />
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title={chatEnabled ? 'Disable chat' : 'Enable chat'}>
              <IconButton
                size="small"
                onClick={toggleChat}
                color={chatEnabled ? 'primary' : 'default'}
              >
                {chatEnabled ? <ChatOnIcon fontSize="small" /> : <ChatOffIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        
        {/* Game Info Row */}
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          {/* Time Control */}
          {game?.timeControl && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <TimerIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                {Math.floor(game.timeControl.initialTime / 60000)}+{game.timeControl.increment / 1000}
              </Typography>
            </Box>
          )}
          
          {/* Creation Time */}
          {game?.startTime && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CalendarIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                {format(new Date(game.startTime), 'MMM d, HH:mm')}
              </Typography>
            </Box>
          )}
          
          {/* Game ID */}
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            #{gameId.slice(0, 8)}
          </Typography>
        </Stack>
      </Box>
      
      {/* Timeout Warning */}
      {isTimedOut && chatEnabled && (
        <Alert 
          severity="warning" 
          icon={<BlockIcon />}
          sx={{ 
            borderRadius: 0,
            py: 1,
          }}
        >
          <Typography variant="body2">
            Chat disabled for {timeoutSecondsRemaining} seconds due to inappropriate content
          </Typography>
        </Alert>
      )}
      
      {/* Messages */}
      <Collapse in={chatEnabled} sx={{ flex: chatEnabled ? 1 : 0, minHeight: 0 }}>
        <Box
          sx={{
            height: '100%',
            overflowY: 'auto',
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-track': {
              bgcolor: 'action.hover',
            },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: 'action.disabled',
              borderRadius: '3px',
            },
          }}
        >
          {messages.length === 0 && (
            <Typography 
              variant="body2" 
              color="text.secondary" 
              sx={{ 
                textAlign: 'center',
                mt: 4,
                fontStyle: 'italic',
              }}
            >
              No messages yet. Start a conversation!
            </Typography>
          )}
          
          {messages.map((message) => 
            message.type === 'server' ? (
              // Server notifications - centered
              <Box
                key={message.id}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  my: 1.5,
                  px: 2,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    opacity: 0.7,
                    fontSize: '0.75rem',
                  }}
                >
                  {format(message.timestamp, 'HH:mm')}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: getMessageColor(message),
                    textAlign: 'center',
                    fontWeight: 'normal',
                    mt: 0.5,
                  }}
                >
                  {message.content}
                </Typography>
              </Box>
            ) : (
              // Regular player messages
              <Box
                key={message.id}
                sx={{
                  display: 'flex',
                  flexDirection: message.senderId === user?.id ? 'row-reverse' : 'row',
                  alignItems: 'flex-start',
                  gap: 1,
                }}
              >
                <Avatar
                  sx={{
                    width: 28,
                    height: 28,
                    bgcolor: message.type === 'player' ? 
                      (message.senderId === user?.id ? 'primary.main' : 'secondary.main') :
                      'grey.500',
                  }}
                >
                  {getMessageIcon(message.type)}
                </Avatar>
                <Box
                  sx={{
                    maxWidth: '70%',
                    bgcolor: message.type === 'player' && message.senderId === user?.id ? 
                      'primary.dark' : 
                      message.type === 'system' ?
                      'background.default' : 'grey.800',
                    borderRadius: 2,
                    p: 1.5,
                    boxShadow: 1,
                  }}
                >
                  {message.senderName && (
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        fontWeight: 'bold',
                        color: getMessageColor(message),
                        display: 'block',
                        mb: 0.5,
                      }}
                    >
                      {message.senderName}
                    </Typography>
                  )}
                  <Typography 
                    variant="body2"
                    sx={{
                      color: message.type === 'player' ? 'text.primary' : getMessageColor(message),
                      wordBreak: 'break-word',
                    }}
                  >
                    {message.content}
                  </Typography>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: 'text.secondary',
                      display: 'block',
                      mt: 0.5,
                    }}
                  >
                    {format(message.timestamp, 'HH:mm')}
                  </Typography>
                </Box>
              </Box>
            )
          )}
          <div ref={messagesEndRef} />
        </Box>
      </Collapse>
      
      {/* Chat disabled indicator */}
      {!chatEnabled && (
        <Box 
          sx={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 1,
            p: 3,
            color: 'text.secondary'
          }}
        >
          <ChatOffIcon sx={{ fontSize: 48, opacity: 0.5 }} />
          <Typography variant="body2" color="text.secondary">
            Chat is disabled
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Click the chat icon above to enable
          </Typography>
        </Box>
      )}
      
      <Divider />
      
      {/* Input */}
      <Collapse in={chatEnabled}>
        <Box sx={{ p: 2 }}>
          {chatError && (
            <Typography 
              variant="caption" 
              color="error" 
              sx={{ display: 'block', mb: 1 }}
            >
              {chatError}
            </Typography>
          )}
          <TextField
            fullWidth
            size="small"
            placeholder={
              isTimedOut 
                ? "You are temporarily unable to send messages"
                : playerInfo?.isPlayer 
                ? "Type a message..." 
                : "Spectators cannot chat"
            }
            value={inputValue}
            onChange={(e) => {
              const value = e.target.value;
              if (value.length <= MAX_MESSAGE_LENGTH) {
                setInputValue(value);
                // Only clear error if there actually is an error
                if (chatError) {
                  setChatError(null);
                }
              }
            }}
            onKeyPress={handleKeyPress}
            disabled={!playerInfo?.isPlayer || isSending || isTimedOut}
            error={!!chatError || isTimedOut}
            helperText={
              isTimedOut 
                ? `Chat timeout: ${timeoutSecondsRemaining}s remaining`
                : inputValue.length > 100 
                ? `${inputValue.length}/${MAX_MESSAGE_LENGTH}${inputValue.length > 150 ? ' ⚠️' : ''}` 
                : ''
            }
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || isSending || !playerInfo?.isPlayer || isTimedOut}
                    color="primary"
                  >
                    <SendIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </Collapse>
    </Paper>
  );
}