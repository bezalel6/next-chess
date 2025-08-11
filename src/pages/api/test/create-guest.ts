import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * API endpoint for creating guest/anonymous users without captcha
 * Uses service role key to bypass captcha requirement
 * ONLY available in development/test environments
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow in development/test environments
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_TEST_ENDPOINTS) {
    return res.status(403).json({ error: 'Test endpoints disabled in production' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Create Supabase client with service role key
    // This bypasses RLS and captcha requirements
    const supabaseService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Create anonymous user using service role
    // The service role bypasses captcha requirements
    const { data, error } = await supabaseService.auth.signInAnonymously();

    if (error) {
      console.error('Error creating guest user:', error);
      return res.status(400).json({ error: error.message });
    }

    if (!data.user || !data.session) {
      return res.status(400).json({ error: 'Failed to create guest user' });
    }

    // Return the session data that can be used to authenticate
    return res.status(200).json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        is_anonymous: data.user.is_anonymous
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      },
      message: 'Guest user created successfully'
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}