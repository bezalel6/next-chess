import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow in test mode
  if (process.env.NEXT_PUBLIC_USE_TEST_AUTH !== 'true') {
    return res.status(403).json({ error: 'Test endpoint only available in test mode' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { whiteUsername, blackUsername } = req.body;

  if (!whiteUsername || !blackUsername) {
    return res.status(400).json({ error: 'Both whiteUsername and blackUsername are required' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // For test mode, create simple anonymous users using admin API
    const getOrCreateUser = async (username: string) => {
      // First try to find existing user by username
      let { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .single();

      if (!profile) {
        // Use admin API to create user
        const { data: userData, error: userError } = await supabase.auth.admin.createUser({
          email: `${username}@test.local`,
          password: 'test1234',
          email_confirm: true,
          user_metadata: { username }
        });

        if (userError) {
          // User might already exist, try to get them
          const { data: { users } } = await supabase.auth.admin.listUsers();
          const existingUser = users?.find((u: any) => u.email === `${username}@test.local`);
          
          if (existingUser) {
            // Update or create profile for existing user
            await supabase
              .from('profiles')
              .upsert({
                id: existingUser.id,
                username: username
              });
            return existingUser.id;
          }
          
          throw new Error(`Failed to create user: ${userError.message}`);
        }

        // Create profile for new user
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: userData.user!.id,
            username: username
          });

        if (profileError) {
          console.error('Profile creation error:', profileError);
        }

        return userData.user!.id;
      }

      return profile.id;
    };

    const whitePlayerId = await getOrCreateUser(whiteUsername);
    const blackPlayerId = await getOrCreateUser(blackUsername);

    // Clear any existing active games for these players
    await supabase
      .from('games')
      .update({ status: 'abandoned' })
      .or(`white_player_id.eq.${whitePlayerId},black_player_id.eq.${blackPlayerId}`)
      .eq('status', 'active');

    // Clear any queue entries (matchmaking table)
    await supabase
      .from('matchmaking')
      .delete()
      .or(`player_id.eq.${whitePlayerId},player_id.eq.${blackPlayerId}`);

    // Generate a game ID
    const gameId = Math.random().toString(36).substring(2, 10);

    // Create a new game with controlled player colors
    const { data: game, error: gameError } = await supabase
      .from('games')
      .insert({
        id: gameId,
        white_player_id: whitePlayerId,
        black_player_id: blackPlayerId,
        status: 'active',
        turn: 'white',
        banning_player: 'black', // Black bans first (White's opening move)
        current_fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        pgn: ''
      })
      .select()
      .single();

    if (gameError) throw gameError;

    return res.status(200).json({
      success: true,
      gameId: game.id,
      whitePlayerId,
      blackPlayerId,
      message: `Game created: ${whiteUsername} (white) vs ${blackUsername} (black)`
    });

  } catch (error) {
    console.error('Error creating test game:', error);
    return res.status(500).json({ 
      error: 'Failed to create test game',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}