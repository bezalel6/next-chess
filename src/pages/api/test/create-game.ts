import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Use service role client for admin operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { playAs = 'white', withBan = false } = req.body;
    const timestamp = Date.now();
    const gameId = `test-${timestamp}`;
    
    // Create test users
    const whiteEmail = `white-test-${timestamp}@test.com`;
    const blackEmail = `black-test-${timestamp}@test.com`;
    const password = 'test123456';
    
    // Create white player
    const { data: whiteUser, error: whiteError } = await supabaseAdmin.auth.admin.createUser({
      email: whiteEmail,
      password,
      email_confirm: true,
      user_metadata: { 
        username: `TestWhite${timestamp}`,
        display_name: 'Test White Player'
      }
    });
    
    if (whiteError) {
      throw new Error(`Failed to create white user: ${whiteError.message}`);
    }
    
    // Create black player
    const { data: blackUser, error: blackError } = await supabaseAdmin.auth.admin.createUser({
      email: blackEmail,
      password,
      email_confirm: true,
      user_metadata: { 
        username: `TestBlack${timestamp}`,
        display_name: 'Test Black Player'
      }
    });
    
    if (blackError) {
      throw new Error(`Failed to create black user: ${blackError.message}`);
    }
    
    // Create the game
    const gameData: any = {
      id: gameId,
      white_player_id: whiteUser.user.id,
      black_player_id: blackUser.user.id,
      status: 'active',
      turn: 'white',
      banning_player: withBan ? null : 'black', // If withBan, game starts after black's ban
      current_fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      pgn: withBan ? '{banning: e2e4}' : '',
      white_time_remaining: 600000000,
      black_time_remaining: 600000000,
      time_control: { initial_time: 600000000, increment: 0 }
    };
    
    // Add banned move if requested
    if (withBan) {
      gameData.current_banned_move = { from: 'e2', to: 'e4' };
    }
    
    const { error: gameError } = await supabaseAdmin
      .from('games')
      .insert(gameData);
    
    if (gameError) {
      throw new Error(`Failed to create game: ${gameError.message}`);
    }
    
    // Return credentials for the selected player
    const selectedEmail = playAs === 'white' ? whiteEmail : blackEmail;
    
    res.status(200).json({
      gameId,
      email: selectedEmail,
      password,
      whitePlayerId: whiteUser.user.id,
      blackPlayerId: blackUser.user.id,
      message: `Test game created. You are playing as ${playAs}.`
    });
    
  } catch (error) {
    console.error('Error creating test game:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to create test game' 
    });
  }
}