import { test, expect } from '@playwright/test';

test.describe('Guest Profile Creation Verification', () => {
  test('verify handle_new_user trigger creates profile for guest', async ({ page }) => {
    console.log('\n=== TESTING GUEST PROFILE CREATION ===\n');
    
    // Track the guest user ID
    let guestUserId: string | null = null;
    
    // Monitor auth responses to capture user ID
    page.on('response', async (response) => {
      const url = response.url();
      
      if (url.includes('auth/v1/signup') && response.status() === 200) {
        try {
          const body = await response.json();
          if (body.user?.id) {
            guestUserId = body.user.id;
            console.log('✅ Guest user created with ID:', guestUserId);
          }
        } catch (e) {}
      }
    });

    // Navigate to app
    await page.goto('http://localhost:3000');
    await page.waitForSelector('button:has-text("Continue as Guest")');
    
    // Click guest signup
    console.log('📍 Signing up as guest...');
    await page.click('button:has-text("Continue as Guest")');
    
    // Wait for auth to complete
    await page.waitForTimeout(2000);
    
    // Verify profile was created
    const profileCheck = await page.evaluate(async () => {
      const supabase = (window as any).supabase;
      if (!supabase) return { error: 'No Supabase client' };
      
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { error: 'No session after guest signup' };
      
      const userId = session.user.id;
      console.log('Checking profile for user:', userId);
      
      // Check if profile exists
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, username, created_at')
        .eq('id', userId)
        .single();
      
      if (error) {
        // Also check if user exists in auth.users
        const { data: authUser, error: authError } = await supabase.auth.admin?.getUserById?.(userId);
        
        return {
          hasProfile: false,
          error: error.message,
          userId,
          authUserExists: !!authUser && !authError
        };
      }
      
      return {
        hasProfile: true,
        profile,
        userId
      };
    });
    
    console.log('\n📊 PROFILE CHECK RESULTS:');
    console.log(JSON.stringify(profileCheck, null, 2));
    
    if (!profileCheck.hasProfile) {
      console.log('\n❌ PROFILE NOT CREATED!');
      console.log('This means the trigger is NOT firing or is failing');
      
      // Try to manually check trigger status
      const triggerCheck = await page.evaluate(async () => {
        const supabase = (window as any).supabase;
        
        // Query to check if trigger exists
        const { data, error } = await supabase.rpc('get_trigger_status', {
          trigger_name: 'on_auth_user_created'
        }).catch((e: any) => ({ data: null, error: e.message }));
        
        return { data, error };
      });
      
      console.log('\nTrigger status check:', triggerCheck);
    } else {
      console.log('\n✅ PROFILE CREATED SUCCESSFULLY!');
      console.log('Username:', profileCheck.profile.username);
      console.log('Created at:', profileCheck.profile.created_at);
    }
    
    // Now test matchmaking with this guest user
    if (profileCheck.hasProfile) {
      console.log('\n📍 Testing matchmaking with guest profile...');
      
      const matchmakingResult = await page.evaluate(async () => {
        const response = await fetch('http://localhost:54321/functions/v1/matchmaking', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(window as any).supabase.auth.session?.access_token}`
          },
          body: JSON.stringify({ action: 'join' })
        });
        
        const data = await response.json();
        return { status: response.status, data };
      });
      
      console.log('\nMatchmaking result:', JSON.stringify(matchmakingResult, null, 2));
      
      if (matchmakingResult.status === 200) {
        console.log('✅ Guest can now join matchmaking!');
      } else {
        console.log('❌ Matchmaking still failing:', matchmakingResult.data.error);
      }
    }
  });
});