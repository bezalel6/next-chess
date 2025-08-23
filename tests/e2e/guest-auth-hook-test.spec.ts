import { test, expect } from '@playwright/test';

test.describe('Guest Auth Hook Flow', () => {
  test('trace guest signup through auth hooks', async ({ page }) => {
    console.log('\n=== TESTING GUEST AUTH HOOK FLOW ===\n');
    
    // Monitor all network requests
    const authRequests: any[] = [];
    const edgeFunctionCalls: any[] = [];
    
    page.on('request', (request) => {
      const url = request.url();
      
      // Track auth endpoint calls
      if (url.includes('/auth/')) {
        authRequests.push({
          url: url,
          method: request.method(),
          endpoint: url.split('/auth/')[1]?.split('?')[0]
        });
      }
      
      // Track edge function calls (especially user-management)
      if (url.includes('/functions/v1/')) {
        edgeFunctionCalls.push({
          url: url,
          method: request.method(),
          function: url.split('/functions/v1/')[1]?.split('?')[0],
          headers: request.headers()
        });
      }
    });

    page.on('response', async (response) => {
      const url = response.url();
      
      // Log user-management function responses
      if (url.includes('/functions/v1/user-management')) {
        console.log('\n🔥 USER-MANAGEMENT EDGE FUNCTION CALLED!');
        console.log('Status:', response.status());
        try {
          const body = await response.json();
          console.log('Response:', JSON.stringify(body, null, 2));
        } catch (e) {
          console.log('Response body not JSON');
        }
      }
      
      // Log auth webhook responses
      if (url.includes('auth/v1/signup')) {
        const status = response.status();
        console.log('\n📍 AUTH SIGNUP RESPONSE:');
        console.log('Status:', status);
        
        if (status === 200) {
          try {
            const body = await response.json();
            console.log('User ID:', body.user?.id);
            console.log('Is Anonymous:', body.user?.is_anonymous);
            console.log('User Metadata:', body.user?.user_metadata);
          } catch (e) {}
        }
      }
    });

    // Navigate to app
    await page.goto('http://localhost:3000');
    await page.waitForSelector('button:has-text("Continue as Guest")');
    
    console.log('\n📋 BEFORE GUEST SIGNUP:');
    console.log('Auth requests so far:', authRequests.length);
    console.log('Edge function calls so far:', edgeFunctionCalls.length);
    
    // Click guest signup
    await page.click('button:has-text("Continue as Guest")');
    
    // Wait for auth to complete
    await page.waitForTimeout(3000);
    
    console.log('\n📋 AFTER GUEST SIGNUP:');
    console.log('\nAuth Endpoints Hit:');
    authRequests.forEach(req => {
      console.log(`  - ${req.method} /auth/${req.endpoint}`);
    });
    
    console.log('\nEdge Functions Called:');
    if (edgeFunctionCalls.length === 0) {
      console.log('  ❌ No edge functions were called!');
      console.log('  This means the auth hook is NOT triggering user-management function');
    } else {
      edgeFunctionCalls.forEach(call => {
        console.log(`  - ${call.method} ${call.function}`);
        if (call.headers['x-supabase-webhook-signature']) {
          console.log('    ✓ Has webhook signature');
        }
      });
    }
    
    // Check if profile was created via database trigger
    const profileCreated = await page.evaluate(async () => {
      const session = (window as any).supabase?.auth?.session;
      if (!session) return { hasProfile: false, error: 'No session' };
      
      try {
        // Try to fetch the profile
        const { data, error } = await (window as any).supabase
          .from('profiles')
          .select('username')
          .eq('id', session.user.id)
          .single();
        
        return {
          hasProfile: !!data,
          username: data?.username,
          error: error?.message
        };
      } catch (e) {
        return { hasProfile: false, error: e.message };
      }
    });
    
    console.log('\n📊 PROFILE CHECK:');
    if (profileCreated.hasProfile) {
      console.log('✅ Profile exists with username:', profileCreated.username);
      console.log('This was created by the DATABASE TRIGGER (handle_new_user)');
    } else {
      console.log('❌ No profile found:', profileCreated.error);
    }
    
    console.log('\n=== SUMMARY ===');
    console.log('Guest signup flow:');
    console.log('1. Client calls auth.signInAnonymously()');
    console.log('2. Supabase Auth creates anonymous user');
    console.log('3. Database trigger handle_new_user() fires');
    console.log('4. Trigger creates profile with guest_xxx username');
    console.log('5. No auth webhook or edge function involved for anonymous users');
  });
});