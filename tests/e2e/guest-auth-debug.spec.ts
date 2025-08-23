import { test, expect } from '@playwright/test';

test.describe('Guest Authentication Debug', () => {
  test('diagnose guest sign-in failure', async ({ page }) => {
    // Set up console logging to capture errors
    const consoleLogs: string[] = [];
    const errors: string[] = [];
    
    page.on('console', (msg) => {
      const text = msg.text();
      consoleLogs.push(`[${msg.type()}] ${text}`);
      if (msg.type() === 'error') {
        errors.push(text);
      }
    });

    // Monitor network requests to auth endpoints
    const authRequests: any[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/auth/') || url.includes('signInAnonymously')) {
        authRequests.push({
          url: url,
          method: request.method(),
          headers: request.headers(),
          postData: request.postData()
        });
      }
    });

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/auth/') || url.includes('signInAnonymously')) {
        const status = response.status();
        let body = null;
        try {
          body = await response.json();
        } catch (e) {
          try {
            body = await response.text();
          } catch (e2) {
            body = 'Could not parse response';
          }
        }
        
        console.log('\n=== AUTH RESPONSE ===');
        console.log('URL:', url);
        console.log('Status:', status);
        console.log('Body:', JSON.stringify(body, null, 2));
        
        if (status >= 400) {
          console.log('ERROR RESPONSE DETAILS:');
          console.log('Headers:', response.headers());
        }
      }
    });

    // Navigate to the app
    console.log('\n=== NAVIGATING TO APP ===');
    await page.goto('http://localhost:3000');
    
    // Wait for the auth form to be visible
    await page.waitForSelector('button:has-text("Continue as Guest")', { timeout: 5000 });
    
    // Check current Supabase configuration
    const supabaseConfig = await page.evaluate(() => {
      // @ts-ignore
      const win = window as any;
      return {
        hasNextData: !!win.__NEXT_DATA__,
        hasSupabaseClient: !!win.supabase,
        locationHref: window.location.href
      };
    });
    
    console.log('\n=== SUPABASE CONFIG ===');
    console.log(JSON.stringify(supabaseConfig, null, 2));

    // Attempt guest sign-in
    console.log('\n=== ATTEMPTING GUEST SIGN-IN ===');
    await page.click('button:has-text("Continue as Guest")');
    
    // Wait for error or success
    await page.waitForTimeout(3000);
    
    // Check for error messages
    const errorAlert = await page.locator('div[role="alert"]').first().textContent().catch(() => null);
    
    console.log('\n=== RESULTS ===');
    console.log('Error Alert:', errorAlert);
    console.log('\nConsole Errors:');
    errors.forEach(err => console.log('  -', err));
    
    console.log('\nAuth Requests Made:');
    authRequests.forEach(req => {
      console.log(`  - ${req.method} ${req.url}`);
      if (req.postData) {
        console.log('    Body:', req.postData);
      }
    });

    // Check if user was created despite error
    const currentUrl = page.url();
    const isLoggedIn = !currentUrl.includes('auth') && currentUrl !== 'http://localhost:3000/';
    
    console.log('\n=== FINAL STATE ===');
    console.log('Current URL:', currentUrl);
    console.log('Appears logged in:', isLoggedIn);
    
    // Verify the actual error
    if (errorAlert) {
      expect(errorAlert).toContain('Database error creating anonymous user');
      
      // Check database trigger status
      console.log('\n=== DATABASE DIAGNOSIS ===');
      console.log('The error "Database error creating anonymous user" indicates:');
      console.log('1. Anonymous sign-ins are enabled in Supabase Auth');
      console.log('2. The auth.users row is created successfully');
      console.log('3. The handle_new_user() trigger is failing');
      console.log('4. Likely cause: trigger cannot handle NULL email for anonymous users');
    }
  });
});