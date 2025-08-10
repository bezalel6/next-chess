import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/env';

const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    // Look up the user id by username from profiles table
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .single();
    
    if (profileError || !profile?.id) {
      return res.status(404).json({ error: 'Username not found' });
    }
    
    // Get the user's email from auth.users
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.id);
    
    if (userError || !userData.user?.email) {
      return res.status(404).json({ error: 'User email not found' });
    }
    
    return res.status(200).json({ email: userData.user.email });
  } catch (error) {
    console.error('Error getting email by username:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}