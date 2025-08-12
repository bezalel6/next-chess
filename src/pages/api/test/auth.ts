import type { NextApiRequest, NextApiResponse } from 'next';
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
    // Check environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing environment variables:', {
        url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        serviceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      });
      return res.status(500).json({ error: 'Server configuration error' });
    }

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

    if (action === 'query-auth') {
      const { username } = req.body;
      
      if (!username) {
        return res.status(400).json({ error: 'Username is required' });
      }

      // Check if user exists by username
      const { data: profiles, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .ilike('username', username)
        .single();

      if (profileError || !profiles) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get user data
      const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(profiles.id);
      
      if (userError || !user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // If user doesn't have an email (guest user), create one for test auth
      const userEmail = user.email || `${username}@test.local`;
      const needsEmailUpdate = !user.email || !user.email_confirmed_at;
      
      // Update user with email and confirm it if needed
      if (needsEmailUpdate) {
        const updateData: any = {
          app_metadata: { ...user.app_metadata, last_test_auth: new Date().toISOString() }
        };
        
        if (!user.email) {
          updateData.email = userEmail;
        }
        
        // Always confirm email for test auth
        if (!user.email_confirmed_at) {
          updateData.email_confirm = true;
          // Set confirmed_at timestamp
          const { error: confirmError } = await supabaseAdmin
            .from('auth.users')
            .update({ 
              email_confirmed_at: new Date().toISOString(),
              confirmed_at: new Date().toISOString()
            })
            .eq('id', profiles.id);
            
          if (confirmError) {
            console.error('Failed to confirm email:', confirmError);
          }
        }
        
        const { error: emailUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
          profiles.id,
          updateData
        );
        
        if (emailUpdateError) {
          console.error('Failed to update user:', emailUpdateError);
        }
      }

      // Create a session by signing them in with a temporary password
      // First set a known password
      const tempPassword = `test-auth-${Date.now()}-${Math.random()}`;
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        profiles.id,
        { 
          password: tempPassword,
          email_confirm: true,
          app_metadata: { ...user.app_metadata, last_test_auth: new Date().toISOString() }
        }
      );

      if (updateError) throw updateError;

      // Now sign in with the temporary password
      const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
        email: userEmail,
        password: tempPassword
      });

      if (authError) throw authError;

      return res.status(200).json({
        user: authData.user,
        session: authData.session
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