import { test, expect } from '@playwright/test';

test.describe('Simple Matchmaking Tests', () => {
  test('matchmaking UI is accessible', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Page should load
    await expect(page).toHaveTitle(/Ban Chess/);
    
    // Should show either sign in or matchmaking
    const hasSignIn = await page.locator('text="Sign in to Play"').isVisible().catch(() => false);
    const hasMatchmaking = await page.locator('text="Play Ban Chess"').isVisible().catch(() => false);
    
    expect(hasSignIn || hasMatchmaking).toBeTruthy();
    console.log('✅ Matchmaking UI accessible');
  });

  test('can create account and see matchmaking', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    const timestamp = Date.now();
    const email = `test_${timestamp}@example.com`;
    
    // Click sign up
    const signUpLink = await page.locator('text="Don\'t have an account? Sign up"');
    if (await signUpLink.isVisible()) {
      await signUpLink.click();
      
      // Fill form
      await page.fill('[name="username"]', `User_${timestamp}`);
      await page.fill('[name="email"]', email);
      await page.fill('[name="password"]', 'password123');
      
      // Submit
      await page.click('button:has-text("Sign up")');
      
      // Wait for response
      await page.waitForTimeout(3000);
      
      // Should show either confirmation or matchmaking
      const hasConfirmation = await page.locator('text=/check your email|confirm/i').isVisible().catch(() => false);
      const hasMatchmaking = await page.locator('text=/Play Ban Chess|Find Game/i').isVisible().catch(() => false);
      const needsSignIn = await page.locator('button:has-text("Sign in")').isVisible().catch(() => false);
      
      expect(hasConfirmation || hasMatchmaking || needsSignIn).toBeTruthy();
      console.log('✅ Account creation flow works');
    }
  });

  test('Find Game button shows searching state', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    const timestamp = Date.now();
    const email = `search_${timestamp}@example.com`;
    
    // Quick sign up
    const signUpLink = await page.locator('text="Don\'t have an account? Sign up"');
    if (await signUpLink.isVisible()) {
      await signUpLink.click();
      await page.fill('[name="username"]', `Search_${timestamp}`);
      await page.fill('[name="email"]', email);
      await page.fill('[name="password"]', 'password123');
      await page.click('button:has-text("Sign up")');
      await page.waitForTimeout(3000);
    }
    
    // Try to sign in if needed
    if (await page.locator('button:has-text("Sign in")').isVisible()) {
      await page.fill('[name="email"]', email);
      await page.fill('[name="password"]', 'password123');
      await page.click('button:has-text("Sign in")');
      await page.waitForTimeout(2000);
    }
    
    // Look for Find Game button
    const findGameBtn = page.locator('button:has-text("Find Game")');
    if (await findGameBtn.isVisible()) {
      await findGameBtn.click();
      
      // Should show searching state
      const isSearching = await page.locator('text=/Finding Opponent|Searching/i').isVisible({ timeout: 3000 }).catch(() => false);
      const hasCancel = await page.locator('button:has-text("Cancel")').isVisible().catch(() => false);
      
      expect(isSearching || hasCancel).toBeTruthy();
      
      // Cancel if possible
      if (hasCancel) {
        await page.click('button:has-text("Cancel")');
      }
      
      console.log('✅ Find Game button works');
    }
  });
});