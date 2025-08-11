import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * Test auth endpoint that bypasses captcha using service role
 * Handles both signup and signin for testing purposes
 * ONLY available when NEXT_PUBLIC_USE_TEST_AUTH is set
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow when test auth is enabled
  if (process.env.NEXT_PUBLIC_USE_TEST_AUTH !== 'true') {
    return res.status(403).json({ error: 'Test auth disabled' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, email, password, username } = req.body;
  
  console.log('Test auth request:', { action, email: email ? 'provided' : 'missing', password: password ? 'provided' : 'missing' });

  if (!action) {
    return res.status(400).json({ error: 'Missing action' });
  }
  
  // Only require email/password for signin and signup
  if ((action === 'signin' || action === 'signup') && (!email || !password)) {
    console.log('Missing fields for', action, ':', { email: !email, password: !password });
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Create admin client with service role
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    if (action === 'signup') {
      // Create user with admin (bypasses captcha)
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username: username || email.split('@')[0] }
      });

      if (authError) throw authError;

      // Create profile
      if (authData.user) {
        await supabaseAdmin.from('profiles').upsert({
          id: authData.user.id,
          username: username || email.split('@')[0]
        });
      }

      // Sign them in to get session
      const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) throw signInError;

      return res.status(200).json({
        user: signInData.user,
        session: signInData.session
      });
    } 
    
    if (action === 'signin') {
      // Sign in with admin client (bypasses captcha)
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      return res.status(200).json({
        user: data.user,
        session: data.session
      });
    }

    if (action === 'guest') {
      // Create anonymous user
      const { data, error } = await supabaseAdmin.auth.signInAnonymously();
      
      if (error) throw error;

      return res.status(200).json({
        user: data.user,
        session: data.session
      });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error: any) {
    console.error('Test auth error:', error);
    return res.status(400).json({ 
      error: error.message || 'Authentication failed'
    });
  }
}