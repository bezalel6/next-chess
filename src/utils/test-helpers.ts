/**
 * Test Helpers for 2-Player Chess Game Testing
 * Utilities for managing multiple authenticated users in tests
 */

import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';

export interface TestUser {
  email: string;
  password: string;
  id?: string;
  session?: Session;
}

export interface TestGame {
  id: string;
  whitePlayerId: string;
  blackPlayerId: string;
  status: string;
}

/**
 * Predefined test users for different roles
 */
export const TEST_USERS = {
  white: {
    email: 'test-white@chess.local',
    password: 'testpass123'
  },
  black: {
    email: 'test-black@chess.local',
    password: 'testpass123'
  },
  spectator: {
    email: 'test-spectator@chess.local',
    password: 'testpass123'
  },
  player3: {
    email: 'test-player3@chess.local',
    password: 'testpass123'
  },
  player4: {
    email: 'test-player4@chess.local',
    password: 'testpass123'
  }
} as const;

/**
 * Test game sequences for automated testing
 */
export const TEST_SEQUENCES = {
  quickGame: [
    { type: 'ban', player: 'black', from: 'e2', to: 'e4' },
    { type: 'move', player: 'white', from: 'd2', to: 'd4' },
    { type: 'ban', player: 'white', from: 'e7', to: 'e5' },
    { type: 'move', player: 'black', from: 'd7', to: 'd5' },
  ],
  scholarsMate: [
    { type: 'ban', player: 'black', from: 'a2', to: 'a3' },
    { type: 'move', player: 'white', from: 'e2', to: 'e4' },
    { type: 'ban', player: 'white', from: 'a7', to: 'a6' },
    { type: 'move', player: 'black', from: 'e7', to: 'e5' },
    { type: 'ban', player: 'black', from: 'g1', to: 'e2' },
    { type: 'move', player: 'white', from: 'f1', to: 'c4' },
    { type: 'ban', player: 'white', from: 'g8', to: 'e7' },
    { type: 'move', player: 'black', from: 'b8', to: 'c6' },
    { type: 'ban', player: 'black', from: 'd1', to: 'e2' },
    { type: 'move', player: 'white', from: 'd1', to: 'h5' },
    { type: 'ban', player: 'white', from: 'g7', to: 'g6' },
    { type: 'move', player: 'black', from: 'g8', to: 'f6' },
    { type: 'ban', player: 'black', from: 'h5', to: 'f3' },
    { type: 'move', player: 'white', from: 'h5', to: 'f7' },
  ]
};

/**
 * Class for managing test users and authentication
 */
export class TestUserManager {
  private users: Map<string, TestUser> = new Map();

  /**
   * Create or authenticate a test user
   */
  async setupUser(role: keyof typeof TEST_USERS): Promise<TestUser> {
    const userData = TEST_USERS[role];
    
    // Try to sign in first
    let { data, error } = await supabase.auth.signInWithPassword({
      email: userData.email,
      password: userData.password
    });

    // If user doesn't exist, create them
    if (error && error.message.includes('Invalid login')) {
      const signUpResult = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password
      });
      
      if (signUpResult.error) {
        throw new Error(`Failed to create test user: ${signUpResult.error.message}`);
      }
      
      data = signUpResult.data;
    } else if (error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }

    const user: TestUser = {
      ...userData,
      id: data.user?.id,
      session: data.session || undefined
    };

    this.users.set(role, user);
    return user;
  }

  /**
   * Get authenticated Supabase client for a specific user
   */
  async getAuthenticatedClient(role: keyof typeof TEST_USERS) {
    const user = this.users.get(role);
    if (!user?.session) {
      throw new Error(`User ${role} not authenticated`);
    }

    // Create a new Supabase client with the user's session
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        },
        global: {
          headers: {
            Authorization: `Bearer ${user.session.access_token}`
          }
        }
      }
    );

    return client;
  }

  /**
   * Clean up all test users
   */
  async cleanup() {
    for (const [role, user] of this.users) {
      if (user.session) {
        await supabase.auth.signOut();
      }
    }
    this.users.clear();
  }
}

/**
 * Class for managing test games
 */
export class TestGameManager {
  private games: TestGame[] = [];

  /**
   * Create a test game between two users
   */
  async createGame(whiteUserId: string, blackUserId: string): Promise<TestGame> {
    const { data, error } = await supabase
      .from('games')
      .insert({
        id: `test-game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        white_player_id: whiteUserId,
        black_player_id: blackUserId,
        status: 'active' as const,
        turn: 'white' as const,
        banning_player: 'black' as const,
        current_fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create game: ${error.message}`);
    }

    const game: TestGame = {
      id: data.id,
      whitePlayerId: data.white_player_id,
      blackPlayerId: data.black_player_id,
      status: data.status
    };

    this.games.push(game);
    return game;
  }

  /**
   * Clean up all test games
   */
  async cleanup() {
    for (const game of this.games) {
      await supabase
        .from('games')
        .delete()
        .eq('id', game.id);
    }
    this.games = [];
  }
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error('Timeout waiting for condition');
}

/**
 * Wait for game state to update
 */
export async function waitForGameUpdate(
  gameId: string,
  expectedState: Partial<any>,
  timeout = 5000
): Promise<void> {
  await waitFor(async () => {
    const { data } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();
    
    if (!data) return false;
    
    return Object.entries(expectedState).every(
      ([key, value]) => data[key] === value
    );
  }, timeout);
}

/**
 * Simulate a game sequence
 */
export async function simulateGameSequence(
  gameId: string,
  sequence: typeof TEST_SEQUENCES[keyof typeof TEST_SEQUENCES],
  whiteClient: any,
  blackClient: any
) {
  for (const action of sequence) {
    const client = action.player === 'white' ? whiteClient : blackClient;
    
    if (action.type === 'ban') {
      await client.functions.invoke('game-action', {
        body: {
          gameId,
          action: 'ban',
          data: { from: action.from, to: action.to }
        }
      });
    } else if (action.type === 'move') {
      await client.functions.invoke('game-action', {
        body: {
          gameId,
          action: 'move',
          data: { from: action.from, to: action.to }
        }
      });
    }
    
    // Wait a bit for the action to process
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

/**
 * Debug logger for tests
 */
export class TestLogger {
  private logs: string[] = [];
  private enabled: boolean;

  constructor(enabled = true) {
    this.enabled = enabled;
  }

  log(message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    
    if (data) {
      this.logs.push(`${logEntry} ${JSON.stringify(data, null, 2)}`);
    } else {
      this.logs.push(logEntry);
    }

    if (this.enabled) {
      console.log(logEntry, data || '');
    }
  }

  getLogs(): string[] {
    return this.logs;
  }

  clear() {
    this.logs = [];
  }
}