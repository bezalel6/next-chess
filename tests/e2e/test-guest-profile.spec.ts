import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

test.describe('Guest Profile Creation', () => {
  test('verify guest user gets profile via trigger', async ({ page }) => {
    console.log('\n=== TESTING PROFILE CREATION VIA TRIGGER ===\n');
    
    // Create a direct Supabase client for testing
    const supabase = createClient(
      'http://localhost:54321',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
    );
    
    // Sign up as guest
    console.log('📍 Creating guest user via Supabase client...');
    const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
    
    if (authError) {
      console.log('❌ Failed to create guest:', authError.message);
      throw authError;
    }
    
    const userId = authData.user?.id;
    console.log('✅ Guest user created with ID:', userId);
    
    // Wait a moment for trigger to fire
    console.log('⏳ Waiting for trigger to create profile...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if profile was created
    console.log('📍 Checking for profile...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId!)
      .single();
    
    if (profileError) {
      console.log('❌ Profile not found:', profileError.message);
      
      // Check if user exists in auth.users
      console.log('📍 Checking auth.users table...');
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.log('❌ Failed to get user:', userError.message);
      } else {
        console.log('✅ User exists in auth.users:');
        console.log('  - ID:', user?.id);
        console.log('  - Email:', user?.email || 'NULL');
        console.log('  - Created:', user?.created_at);
      }
      
      throw new Error('Profile was not created by trigger');
    }
    
    console.log('✅ Profile found!');
    console.log('  - Username:', profile.username);
    console.log('  - Created at:', profile.created_at);
    
    // Now test matchmaking
    console.log('\n📍 Testing matchmaking with guest profile...');
    
    // Get the session token
    const { data: { session } } = await supabase.auth.getSession();
    
    const matchmakingResponse = await fetch('http://localhost:54321/functions/v1/matchmaking', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`
      },
      body: JSON.stringify({ operation: 'joinQueue' })
    });
    
    const matchmakingData = await matchmakingResponse.json();
    
    console.log('📊 Matchmaking response:');
    console.log('  - Status:', matchmakingResponse.status);
    console.log('  - Data:', JSON.stringify(matchmakingData, null, 2));
    
    if (matchmakingResponse.ok) {
      console.log('\n✅ SUCCESS! Guest can join matchmaking!');
    } else {
      console.log('\n❌ Matchmaking failed:', matchmakingData.error);
    }
    
    // Clean up
    await supabase.auth.signOut();
    
    // Verify the profile was created
    expect(profile).toBeTruthy();
    expect(profile.username).toContain('guest_');
    expect(matchmakingResponse.ok).toBeTruthy();
  });
});