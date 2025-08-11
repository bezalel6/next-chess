import { Page } from 'puppeteer';
import { TEST_CONFIG } from './test-config';
import { supabase } from '../../src/utils/supabase';

export class AuthHelper {
  /**
   * Create test users in the database
   */
  static async createTestUsers(): Promise<void> {
    console.log('Creating test users...');
    
    for (const [key, user] of Object.entries(TEST_CONFIG.testUsers)) {
      try {
        // Sign up user via Supabase Auth
        const { data, error } = await supabase.auth.signUp({
          email: user.email,
          password: user.password,
          options: {
            data: {
              username: user.username,
            },
          },
        });
        
        if (error && !error.message.includes('already registered')) {
          throw error;
        }
        
        if (data?.user) {
          console.log(`Created test user: ${user.email}`);
        } else {
          console.log(`Test user already exists: ${user.email}`);
        }
      } catch (error) {
        console.error(`Error creating test user ${user.email}:`, error);
      }
    }
  }

  /**
   * Clean up test users from the database
   */
  static async cleanupTestUsers(): Promise<void> {
    console.log('Cleaning up test users...');
    
    // Note: This requires admin access to delete users
    // In a real scenario, you'd use the service role key
    for (const user of Object.values(TEST_CONFIG.testUsers)) {
      try {
        // Delete user data from games, profiles, etc.
        const { error: profileError } = await supabase
          .from('profiles')
          .delete()
          .match({ username: user.username });
          
        if (profileError) {
          console.error(`Error deleting profile for ${user.username}:`, profileError);
        }
      } catch (error) {
        console.error(`Error cleaning up ${user.email}:`, error);
      }
    }
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