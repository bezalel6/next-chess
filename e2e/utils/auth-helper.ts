import { Page } from 'puppeteer';
import { TEST_CONFIG } from './test-config';

export class AuthHelper {
  /**
   * Create a guest user for testing without captcha
   */
  static async createGuestUser(page: Page): Promise<{ userId: string; accessToken: string }> {
    console.log('Creating guest user via API...');
    
    // Call our test API endpoint to create a guest user
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/test/create-guest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return res.json();
    });
    
    if (!response.success) {
      throw new Error(`Failed to create guest user: ${response.error}`);
    }
    
    console.log(`Created guest user: ${response.user.id}`);
    
    // Set the session in the browser
    await page.evaluate((sessionData) => {
      // Store the session in localStorage for Supabase to pick up
      const storageKey = `sb-${window.location.hostname.split('.')[0]}-auth-token`;
      localStorage.setItem(storageKey, JSON.stringify({
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        expires_at: sessionData.session.expires_at,
        user: sessionData.user
      }));
    }, response);
    
    // Reload the page to apply the session
    await page.reload({ waitUntil: 'networkidle0' });
    
    return {
      userId: response.user.id,
      accessToken: response.session.access_token
    };
  }
  
  /**
   * Create test users in the database (deprecated - use createGuestUser instead)
   */
  static async createTestUsers(): Promise<void> {
    console.log('Note: createTestUsers is deprecated. Use createGuestUser for testing.');
  }

  /**
   * Clean up guest users (they auto-expire after 30 days)
   */
  static async cleanupTestUsers(): Promise<void> {
    console.log('Guest users auto-expire after 30 days, no cleanup needed.');
  }

  /**
   * Sign in as guest without UI interaction
   */
  static async signInAsGuest(page: Page): Promise<void> {
    console.log('Signing in as guest...');
    
    // Navigate to home page
    await page.goto(TEST_CONFIG.baseUrl, {
      waitUntil: 'networkidle0',
    });
    
    // Create guest user and set session
    await this.createGuestUser(page);
    
    // Verify we're logged in
    await page.waitForSelector(TEST_CONFIG.selectors.joinQueueButton, {
      timeout: 10000,
    });
    
    console.log('Successfully signed in as guest');
  }
  
  /**
   * Sign in a user via the UI
   */
  static async signIn(page: Page, email: string, password: string): Promise<void> {
    console.log(`Signing in as ${email}...`);
    
    // Navigate to login page
    await page.goto(`${TEST_CONFIG.baseUrl}/auth/signin`, {
      waitUntil: 'networkidle0',
    });
    
    // Fill in credentials
    await page.type(TEST_CONFIG.selectors.emailInput, email);
    await page.type(TEST_CONFIG.selectors.passwordInput, password);
    
    // Click sign in
    await page.click(TEST_CONFIG.selectors.loginButton);
    
    // Wait for redirect to home page
    await page.waitForNavigation({
      waitUntil: 'networkidle0',
    });
    
    // Verify we're logged in by checking for user menu or queue button
    await page.waitForSelector(TEST_CONFIG.selectors.joinQueueButton, {
      timeout: 10000,
    });
    
    console.log(`Successfully signed in as ${email}`);
  }

  /**
   * Sign up a new user via the UI
   */
  static async signUp(page: Page, email: string, password: string, username: string): Promise<void> {
    console.log(`Signing up as ${email}...`);
    
    // Navigate to signup page
    await page.goto(`${TEST_CONFIG.baseUrl}/auth/signup`, {
      waitUntil: 'networkidle0',
    });
    
    // Fill in credentials
    await page.type(TEST_CONFIG.selectors.emailInput, email);
    await page.type(TEST_CONFIG.selectors.passwordInput, password);
    await page.type('input[name="username"]', username);
    
    // Click sign up
    await page.click(TEST_CONFIG.selectors.signupButton);
    
    // Wait for redirect to home page
    await page.waitForNavigation({
      waitUntil: 'networkidle0',
    });
    
    console.log(`Successfully signed up as ${email}`);
  }
}