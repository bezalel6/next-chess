import { RealtimeChannel } from '@supabase/supabase-js';

interface ChannelOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  heartbeatInterval?: number;
}

/**
 * Enhanced realtime channel with automatic reconnection and heartbeat
 */
export class ReliableChannel {
  private channel: RealtimeChannel;
  private reconnectAttempts = 0;
  private isConnected = false;
  private heartbeatTimer?: NodeJS.Timeout;
  private reconnectTimer?: NodeJS.Timeout;
  private lastMessageTime = Date.now();
  
  constructor(
    channel: RealtimeChannel,
    private options: ChannelOptions = {}
  ) {
    this.channel = channel;
    this.setupHeartbeat();
    this.monitorConnection();
  }
  
  private setupHeartbeat() {
    const interval = this.options.heartbeatInterval || 30000; // 30 seconds
    
    this.heartbeatTimer = setInterval(() => {
      const timeSinceLastMessage = Date.now() - this.lastMessageTime;
      
      // If no message received in 2x heartbeat interval, assume disconnected
      if (timeSinceLastMessage > interval * 2 && this.isConnected) {
        console.warn('[ReliableChannel] Heartbeat timeout, attempting reconnect');
        this.handleDisconnect();
      }
    }, interval);
  }
  
  private monitorConnection() {
    // Monitor channel subscription status
    this.channel.on('system', { event: 'error' }, (payload) => {
      console.error('[ReliableChannel] System error:', payload);
      this.options.onError?.(new Error(payload.message || 'Channel error'));
      this.handleDisconnect();
    });
    
    // Track connection state
    this.channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.lastMessageTime = Date.now();
        this.options.onConnect?.();
        console.log('[ReliableChannel] Connected successfully');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.handleDisconnect();
      }
    });
  }
  
  private handleDisconnect() {
    if (!this.isConnected) return;
    
    this.isConnected = false;
    this.options.onDisconnect?.();
    
    const maxAttempts = this.options.maxReconnectAttempts || 10;
    if (this.reconnectAttempts >= maxAttempts) {
      console.error('[ReliableChannel] Max reconnection attempts reached');
      this.cleanup();
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.calculateBackoff();
    
    console.log(`[ReliableChannel] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnect();
    }, delay);
  }
  
  private calculateBackoff(): number {
    const baseDelay = this.options.reconnectDelay || 1000;
    // Exponential backoff with jitter
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
    const jitter = Math.random() * 1000;
    return exponentialDelay + jitter;
  }
  
  private async reconnect() {
    try {
      // Unsubscribe and resubscribe
      await this.channel.unsubscribe();
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay
      
      this.channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.lastMessageTime = Date.now();
          this.options.onConnect?.();
          console.log('[ReliableChannel] Reconnected successfully');
        }
      });
    } catch (error) {
      console.error('[ReliableChannel] Reconnection failed:', error);
      this.handleDisconnect();
    }
  }
  
  public updateLastMessageTime() {
    this.lastMessageTime = Date.now();
  }
  
  public cleanup() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.channel.unsubscribe();
  }
  
  public getChannel(): RealtimeChannel {
    return this.channel;
  }
  
  public isActive(): boolean {
    return this.isConnected;
  }
}

/**
 * Message deduplication for handling duplicate broadcasts
 */
export class MessageDeduplicator {
  private messageCache = new Map<string, number>();
  private readonly maxCacheSize = 100;
  private readonly ttl = 60000; // 1 minute
  
  /**
   * Check if message is duplicate
   */
  isDuplicate(messageId: string): boolean {
    const now = Date.now();
    
    // Clean old entries
    this.cleanup(now);
    
    // Check if message exists and is still valid
    const timestamp = this.messageCache.get(messageId);
    if (timestamp && now - timestamp < this.ttl) {
      return true;
    }
    
    // Add new message
    this.messageCache.set(messageId, now);
    
    // Limit cache size
    if (this.messageCache.size > this.maxCacheSize) {
      const firstKey = this.messageCache.keys().next().value;
      this.messageCache.delete(firstKey);
    }
    
    return false;
  }
  
  private cleanup(now: number) {
    for (const [id, timestamp] of this.messageCache.entries()) {
      if (now - timestamp > this.ttl) {
        this.messageCache.delete(id);
      }
    }
  }
  
  /**
   * Generate message ID from payload
   */
  static generateId(payload: unknown): string {
    const str = JSON.stringify(payload);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }
}