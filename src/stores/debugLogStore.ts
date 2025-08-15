import { create } from 'zustand';

export interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'broadcast-sent' | 'broadcast-received' | 'api-call' | 'api-response' | 'error' | 'info' | 'state-change';
  category: 'move' | 'ban' | 'game' | 'connection' | 'other';
  message: string;
  data?: any;
  direction?: 'in' | 'out';
}

interface DebugLogStore {
  logs: LogEntry[];
  maxLogs: number;
  enabled: boolean;
  filter: {
    types: Set<LogEntry['type']>;
    categories: Set<LogEntry['category']>;
  };
  
  // Actions
  addLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
  setEnabled: (enabled: boolean) => void;
  setMaxLogs: (max: number) => void;
  toggleTypeFilter: (type: LogEntry['type']) => void;
  toggleCategoryFilter: (category: LogEntry['category']) => void;
  
  // Helper methods for common log types
  logBroadcastSent: (event: string, payload: any) => void;
  logBroadcastReceived: (event: string, payload: any) => void;
  logApiCall: (operation: string, params: any) => void;
  logApiResponse: (operation: string, response: any) => void;
  logError: (message: string, error: any) => void;
  logStateChange: (state: string, data: any) => void;
}

export const useDebugLogStore = create<DebugLogStore>((set, get) => ({
  logs: [],
  maxLogs: 100,
  enabled: true,
  filter: {
    types: new Set(['broadcast-sent', 'broadcast-received', 'api-call', 'api-response', 'error', 'state-change']),
    categories: new Set(['move', 'ban', 'game', 'connection', 'other']),
  },
  
  addLog: (entry) => {
    const state = get();
    if (!state.enabled) return;
    
    const newLog: LogEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    
    set({
      logs: [newLog, ...state.logs].slice(0, state.maxLogs),
    });
  },
  
  clearLogs: () => set({ logs: [] }),
  
  setEnabled: (enabled) => set({ enabled }),
  
  setMaxLogs: (maxLogs) => set({ maxLogs }),
  
  toggleTypeFilter: (type) => {
    const state = get();
    const newTypes = new Set(state.filter.types);
    if (newTypes.has(type)) {
      newTypes.delete(type);
    } else {
      newTypes.add(type);
    }
    set({ filter: { ...state.filter, types: newTypes } });
  },
  
  toggleCategoryFilter: (category) => {
    const state = get();
    const newCategories = new Set(state.filter.categories);
    if (newCategories.has(category)) {
      newCategories.delete(category);
    } else {
      newCategories.add(category);
    }
    set({ filter: { ...state.filter, categories: newCategories } });
  },
  
  // Helper methods
  logBroadcastSent: (event, payload) => {
    get().addLog({
      type: 'broadcast-sent',
      category: event === 'ban' ? 'ban' : event === 'move' ? 'move' : 'other',
      message: `📤 Broadcast sent: ${event}`,
      data: payload,
      direction: 'out',
    });
  },
  
  logBroadcastReceived: (event, payload) => {
    get().addLog({
      type: 'broadcast-received',
      category: event === 'ban' ? 'ban' : event === 'move' ? 'move' : 'other',
      message: `📥 Broadcast received: ${event}`,
      data: payload,
      direction: 'in',
    });
  },
  
  logApiCall: (operation, params) => {
    get().addLog({
      type: 'api-call',
      category: operation.includes('ban') ? 'ban' : operation.includes('move') ? 'move' : 'game',
      message: `🔄 API Call: ${operation}`,
      data: params,
      direction: 'out',
    });
  },
  
  logApiResponse: (operation, response) => {
    get().addLog({
      type: 'api-response',
      category: operation.includes('ban') ? 'ban' : operation.includes('move') ? 'move' : 'game',
      message: `✅ API Response: ${operation}`,
      data: response,
      direction: 'in',
    });
  },
  
  logError: (message, error) => {
    get().addLog({
      type: 'error',
      category: 'other',
      message: `❌ Error: ${message}`,
      data: error,
    });
  },
  
  logStateChange: (state, data) => {
    get().addLog({
      type: 'state-change',
      category: 'game',
      message: `🔧 State: ${state}`,
      data,
    });
  },
}));