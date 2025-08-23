import { test, expect } from '@playwright/test';

test.describe('Ban Chess with Screenshots', () => {
  test('homepage and sign up flow', async ({ page }) => {
    // Go to homepage
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of homepage
    await page.screenshot({ path: 'tests/screenshots/01-homepage.png', fullPage: true });
    console.log('📸 Screenshot: Homepage');
    
    // Check title
    await expect(page).toHaveTitle(/Ban Chess/);
    
    // Click sign up if available
    const signUpLink = page.locator('text="Don\'t have an account? Sign up"');
    if (await signUpLink.isVisible()) {
      await signUpLink.click();
      await page.waitForTimeout(1000);
      
      // Screenshot of sign up form
      await page.screenshot({ path: 'tests/screenshots/02-signup-form.png', fullPage: true });
      console.log('📸 Screenshot: Sign up form');
      
      // Fill the form
      const timestamp = Date.now();
      await page.fill('[name="username"]', `TestUser_${timestamp}`);
      await page.fill('[name="email"]', `test_${timestamp}@example.com`);
      await page.fill('[name="password"]', 'password123');
      
      // Screenshot with filled form
      await page.screenshot({ path: 'tests/screenshots/03-signup-filled.png', fullPage: true });
      console.log('📸 Screenshot: Filled sign up form');
      
      // Submit
      await page.click('button:has-text("Sign up")');
      await page.waitForTimeout(3000);
      
      // Screenshot after submission
      await page.screenshot({ path: 'tests/screenshots/04-after-signup.png', fullPage: true });
      console.log('📸 Screenshot: After sign up');
    }
  });

  test('matchmaking UI flow', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    const timestamp = Date.now();
    const email = `player_${timestamp}@example.com`;
    
    // Sign up first
    const signUpLink = page.locator('text="Don\'t have an account? Sign up"');
    if (await signUpLink.isVisible()) {
      await signUpLink.click();
      await page.fill('[name="username"]', `Player_${timestamp}`);
      await page.fill('[name="email"]', email);
      await page.fill('[name="password"]', 'password123');
      await page.click('button:has-text("Sign up")');
      await page.waitForTimeout(3000);
    }
    
    // Try to sign in if needed
    if (await page.locator('button:has-text("Sign in")').isVisible()) {
      await page.fill('[name="email"]', email);
      await page.fill('[name="password"]', 'password123');
      
      // Screenshot before sign in
      await page.screenshot({ path: 'tests/screenshots/05-signin-form.png', fullPage: true });
      console.log('📸 Screenshot: Sign in form');
      
      await page.click('button:has-text("Sign in")');
      await page.waitForTimeout(2000);
    }
    
    // Screenshot after auth
    await page.screenshot({ path: 'tests/screenshots/06-after-auth.png', fullPage: true });
    console.log('📸 Screenshot: After authentication');
    
    // Look for Find Game button
    const findGameBtn = page.locator('button:has-text("Find Game")');
    if (await findGameBtn.isVisible()) {
      // Screenshot matchmaking UI
      await page.screenshot({ path: 'tests/screenshots/07-matchmaking-ui.png', fullPage: true });
      console.log('📸 Screenshot: Matchmaking UI');
      
      // Click Find Game
      await findGameBtn.click();
      await page.waitForTimeout(2000);
      
      // Screenshot searching state
      await page.screenshot({ path: 'tests/screenshots/08-searching.png', fullPage: true });
      console.log('📸 Screenshot: Searching for opponent');
      
      // Cancel if possible
      const cancelBtn = page.locator('button:has-text("Cancel")');
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
        await page.waitForTimeout(1000);
        
        // Screenshot after cancel
        await page.screenshot({ path: 'tests/screenshots/09-after-cancel.png', fullPage: true });
        console.log('📸 Screenshot: After canceling search');
      }
    }
  });

  test('game page', async ({ page }) => {
    const testGameId = 'test-game-123';
    await page.goto(`http://localhost:3000/game/${testGameId}`);
    await page.waitForTimeout(3000);
    
    // Screenshot game page
    await page.screenshot({ path: 'tests/screenshots/10-game-page.png', fullPage: true });
    console.log('📸 Screenshot: Game page');
    
    // Check for game elements
    const hasGameContent = 
      await page.locator('text=/Game ID|Turn:|Loading game/i').isVisible().catch(() => false);
    
    if (hasGameContent) {
      console.log('✅ Game page loaded');
    }
  });

  test('responsive design', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/screenshots/11-desktop.png', fullPage: true });
    console.log('📸 Screenshot: Desktop view');
    
    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/screenshots/12-tablet.png', fullPage: true });
    console.log('📸 Screenshot: Tablet view');
    
    // Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/screenshots/13-mobile.png', fullPage: true });
    console.log('📸 Screenshot: Mobile view');
  });
});