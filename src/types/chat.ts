export type ChatMessageType = 'player' | 'system' | 'server';

export interface ChatMessage {
  id: string;
  gameId: string;
  type: ChatMessageType;
  senderId?: string;
  senderName?: string;
  content: string;
  timestamp: Date;
  metadata?: {
    eventType?: 'match_start' | 'match_found' | 'game_end' | 'player_joined' | 'player_left' | 'move' | 'ban' | 'draw_offer' | 'resign' | 'timeout';
    result?: string;
    [key: string]: unknown;
  };
}

export interface ChatState {
  messages: ChatMessage[];
  isConnected: boolean;
  typingIndicators: Record<string, boolean>;
}