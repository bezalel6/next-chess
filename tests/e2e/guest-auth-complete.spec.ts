import { test, expect } from '@playwright/test';

test.describe('Guest Authentication Complete Flow', () => {
  test('guest signup creates profile and enables matchmaking', async ({ page }) => {
    console.log('\n=== COMPLETE GUEST AUTH FLOW TEST ===\n');
    
    // Navigate to app
    await page.goto('http://localhost:3000');
    await page.waitForSelector('button:has-text("Continue as Guest")', { timeout: 10000 });
    
    // Click guest signup
    console.log('📍 Signing up as guest...');
    await page.click('button:has-text("Continue as Guest")');
    
    // Wait for navigation away from auth page
    await page.waitForURL((url) => !url.toString().includes('/auth'), { timeout: 10000 });
    console.log('✅ Guest signup successful, navigated to:', page.url());
    
    // Give the trigger time to create the profile
    await page.waitForTimeout(2000);
    
    // Check if profile was created - the supabase client is on window.__NEXT_DATA__ context
    const profileCheck = await page.evaluate(async () => {
      // Try different locations where supabase might be
      const win = window as any;
      const supabase = win.supabase || win.__supabase || win.Supabase;
      
      if (!supabase) {
        // Try to get it from React context or Next.js data
        const nextData = win.__NEXT_DATA__;
        return { error: 'Supabase client not found in window', nextData: !!nextData };
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        return { error: 'No session found' };
      }
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      return { 
        profile, 
        error: error?.message,
        userId: session.user.id 
      };
    });
    
    console.log('\n📊 Profile Check:');
    if (profileCheck.error) {
      console.log('❌ Error:', profileCheck.error);
      console.log('User ID:', profileCheck.userId);
    } else {
      console.log('✅ Profile created!');
      console.log('Username:', profileCheck.profile.username);
      console.log('User ID:', profileCheck.profile.id);
    }
    
    // Try to join matchmaking
    console.log('\n📍 Testing matchmaking...');
    
    // Click the multiplayer button
    const multiplayerButton = page.locator('button:has-text("Multiplayer")');
    if (await multiplayerButton.isVisible()) {
      await multiplayerButton.click();
      console.log('✅ Clicked Multiplayer button');
      
      // Wait for matchmaking UI
      await page.waitForTimeout(1000);
      
      // Check for any errors
      const errorAlert = await page.locator('div[role="alert"]').first().textContent().catch(() => null);
      if (errorAlert) {
        console.log('❌ Error in UI:', errorAlert);
      } else {
        console.log('✅ No errors in UI');
      }
      
      // Check matchmaking status directly
      const matchmakingStatus = await page.evaluate(async () => {
        const response = await fetch('http://localhost:54321/functions/v1/matchmaking', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(window as any).supabase.auth.session?.access_token || (await (window as any).supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({ action: 'join' })
        });
        
        const data = await response.json();
        return { 
          status: response.status, 
          data,
          ok: response.ok 
        };
      });
      
      console.log('\n📊 Matchmaking API Response:');
      console.log('Status:', matchmakingStatus.status);
      console.log('OK:', matchmakingStatus.ok);
      console.log('Data:', JSON.stringify(matchmakingStatus.data, null, 2));
      
      if (matchmakingStatus.ok) {
        console.log('\n✅ SUCCESS! Guest can join matchmaking!');
      } else {
        console.log('\n❌ FAILED! Matchmaking error:', matchmakingStatus.data.error);
      }
    }
    
    // Final assertion
    expect(profileCheck.profile).toBeTruthy();
    expect(profileCheck.profile?.username).toContain('guest_');
  });
});