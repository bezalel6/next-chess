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
} from '@mui/icons-material';
import { format } from 'date-fns';
import type { ChatMessage, ChatMessageType } from '@/types/chat';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface GameChatProps {
  gameId: string;
}

const MAX_MESSAGE_LENGTH = 200;
const MIN_MESSAGE_INTERVAL = 500; // ms between messages
const CHAT_ENABLED_KEY = 'chess-chat-enabled';

export default function GameChat({ gameId }: GameChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [otherPlayerTyping, setOtherPlayerTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatEnabled, setChatEnabled] = useState<boolean>(() => {
    // Load chat preference from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(CHAT_ENABLED_KEY);
      return saved !== null ? saved === 'true' : true; // Default to enabled
    }
    return true;
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageTimeRef = useRef<number>(0);
  const gameStateUnsubRef = useRef<(() => void) | null>(null);
  
  const { user } = useAuth();
  const game = useUnifiedGameStore(s => s.game);
  
  // Memoize player info to avoid recalculation
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
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // Toggle chat enabled/disabled
  const toggleChat = useCallback(() => {
    const newState = !chatEnabled;
    setChatEnabled(newState);
    localStorage.setItem(CHAT_ENABLED_KEY, String(newState));
    if (!newState) {
      setError(null); // Clear any errors when disabling
    }
  }, [chatEnabled]);
  
  // Clear messages when game changes
  useEffect(() => {
    setMessages([]);
  }, [gameId]);
  
  // Set up real-time subscription
  useEffect(() => {
    if (!gameId || !chatEnabled) return;
    
    const channel = supabase
      .channel(`game-chat:${gameId}`)
      .on('broadcast', { event: 'chat_message' }, ({ payload }) => {
        const message = payload as ChatMessage;
        if (message.senderId !== user?.id) {
          setMessages(prev => [...prev, message]);
        }
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId !== user?.id) {
          setOtherPlayerTyping(payload.isTyping);
          if (payload.isTyping) {
            // Clear existing timeout
            if (typingTimeoutRef.current) {
              clearTimeout(typingTimeoutRef.current);
            }
            // Set new timeout
            typingTimeoutRef.current = setTimeout(() => {
              setOtherPlayerTyping(false);
              typingTimeoutRef.current = null;
            }, 3000);
          }
        }
      })
      .on('broadcast', { event: 'game_event' }, ({ payload }) => {
        const eventMessage: ChatMessage = {
          id: `system-${Date.now()}-${Math.random()}`,
          gameId,
          type: 'server',
          content: payload.message,
          timestamp: new Date(),
          metadata: payload.metadata
        };
        setMessages(prev => [...prev, eventMessage]);
      })
      .subscribe();
    
    channelRef.current = channel;
    
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [gameId, user?.id, chatEnabled]);
  
  // Listen to game state changes for server notifications
  useEffect(() => {
    // Clean up previous subscription
    if (gameStateUnsubRef.current) {
      gameStateUnsubRef.current();
    }
    
    const unsubscribe = useUnifiedGameStore.subscribe(
      (state) => state.game,
      (game) => {
        if (!game) return;
        
        // Check for game end
        if (game.status === 'finished') {
          const result = game.result;
          let resultMessage = '';
          
          if (result === 'white') {
            resultMessage = `Game Over: ${game.whitePlayer} wins!`;
          } else if (result === 'black') {
            resultMessage = `Game Over: ${game.blackPlayer} wins!`;
          } else if (result === 'draw') {
            resultMessage = 'Game Over: Draw!';
          }
          
          if (resultMessage) {
            const gameEndMessage: ChatMessage = {
              id: `system-end-${Date.now()}`,
              gameId,
              type: 'server',
              content: resultMessage,
              timestamp: new Date(),
              metadata: { eventType: 'game_end', result }
            };
            setMessages(prev => {
              const hasEndMessage = prev.some(m => m.metadata?.eventType === 'game_end');
              return hasEndMessage ? prev : [...prev, gameEndMessage];
            });
          }
        }
        
        // Check for draw offers
        if (game.drawOfferedBy) {
          const offeringPlayer = game.drawOfferedBy === game.whitePlayerId ? game.whitePlayer : game.blackPlayer;
          const drawOfferMessage: ChatMessage = {
            id: `system-draw-${Date.now()}`,
            gameId,
            type: 'server',
            content: `${offeringPlayer} offers a draw`,
            timestamp: new Date(),
            metadata: { eventType: 'draw_offer' }
          };
          setMessages(prev => {
            const hasDrawMessage = prev.some(m => m.metadata?.eventType === 'draw_offer');
            return hasDrawMessage ? prev : [...prev, drawOfferMessage];
          });
        }
      }
    );
    
    gameStateUnsubRef.current = unsubscribe;
    
    return () => {
      if (gameStateUnsubRef.current) {
        gameStateUnsubRef.current();
        gameStateUnsubRef.current = null;
      }
    };
  }, [gameId]);
  
  const handleSendMessage = useCallback(async () => {
    const trimmedInput = inputValue.trim();
    
    // Validation
    if (!trimmedInput || !user || !game || !playerInfo?.isPlayer) return;
    if (trimmedInput.length > MAX_MESSAGE_LENGTH) {
      setError(`Message too long (max ${MAX_MESSAGE_LENGTH} characters)`);
      return;
    }
    
    // Rate limiting
    const now = Date.now();
    if (now - lastMessageTimeRef.current < MIN_MESSAGE_INTERVAL) {
      setError('Please wait before sending another message');
      return;
    }
    
    setIsSending(true);
    setError(null);
    
    try {
      const message: ChatMessage = {
        id: `${user.id}-${Date.now()}-${Math.random()}`,
        gameId,
        type: 'player',
        senderId: user.id,
        senderName: playerInfo.username,
        content: trimmedInput,
        timestamp: new Date(),
      };
      
      // Add to local state immediately
      setMessages(prev => [...prev, message]);
      setInputValue('');
      lastMessageTimeRef.current = now;
      
      // Broadcast to other players
      if (channelRef.current) {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'chat_message',
          payload: message
        });
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message. Please try again.');
      // Remove optimistic message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsSending(false);
    }
  }, [inputValue, user, game, gameId, playerInfo]);
  
  const handleTyping = (isTyping: boolean) => {
    if (channelRef.current && user) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: user.id, isTyping }
      });
    }
  };
  
  const handleKeyPress = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  const getMessageIcon = (type: ChatMessageType) => {
    switch (type) {
      case 'player': return <PersonIcon sx={{ fontSize: 16 }} />;
      case 'system': return <InfoIcon sx={{ fontSize: 16 }} />;
      case 'server': return <BotIcon sx={{ fontSize: 16 }} />;
    }
  };
  
  const getMessageColor = (message: ChatMessage) => {
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
            {chatEnabled && otherPlayerTyping && (
              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                Opponent is typing...
              </Typography>
            )}
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
        {messages.map((message) => 
          message.type === 'server' ? (
            // Server notifications - centered with border
            (<Box
              key={message.id}
              sx={{
                display: 'flex',
                justifyContent: 'center',
                my: 2,
                px: 2,
              }}
            >
              <Paper
                variant="outlined"
                sx={{
                  bgcolor: 'background.paper',
                  borderRadius: 1,
                  p: 1.5,
                  maxWidth: '75%',
                  textAlign: 'center',
                  border: '1px solid',
                  borderColor: message.metadata?.eventType === 'game_end' ? 'success.main' : 
                               message.metadata?.eventType === 'match_found' ? 'info.main' : 
                               'warning.main',
                }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <InfoIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.primary',
                        fontWeight: 500,
                      }}
                    >
                      {message.content}
                    </Typography>
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      fontSize: '0.7rem',
                    }}
                  >
                    {format(message.timestamp, 'HH:mm')}
                  </Typography>
                </Box>
              </Paper>
            </Box>)
          ) : (
            // Regular player and system messages
            (<Box
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
            </Box>)
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
        <TextField
          fullWidth
          size="small"
          placeholder={playerInfo?.isPlayer ? "Type a message..." : "Spectators cannot chat"}
          value={inputValue}
          onChange={(e) => {
            const value = e.target.value;
            if (value.length <= MAX_MESSAGE_LENGTH) {
              setInputValue(value);
              setError(null);
            }
          }}
          onKeyPress={handleKeyPress}
          onFocus={() => handleTyping(true)}
          onBlur={() => handleTyping(false)}
          disabled={!playerInfo?.isPlayer || isSending}
          error={!!error}
          helperText={error || (inputValue.length > 100 ? `${inputValue.length}/${MAX_MESSAGE_LENGTH}${inputValue.length > 150 ? ' ⚠️' : ''}` : '')}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isSending || !playerInfo?.isPlayer}
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