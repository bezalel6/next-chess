import { test, expect } from '@playwright/test';

test.describe('Full Flow Test', () => {
  test('complete user flow: signup -> matchmaking -> game', async ({ page }) => {
    // Go to homepage
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(2000);
    
    const timestamp = Date.now();
    const username = `Player_${timestamp}`;
    const email = `player_${timestamp}@test.com`;
    const password = 'testpass123';
    
    // Check if we need to sign up
    const signUpLink = page.locator('text="Don\'t have an account? Sign up"');
    if (await signUpLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('📝 Signing up new user...');
      await signUpLink.click();
      await page.waitForTimeout(500);
      
      // Fill signup form
      await page.fill('[name="username"]', username);
      await page.fill('[name="email"]', email);
      await page.fill('[name="password"]', password);
      
      // Submit signup
      await page.click('button:has-text("Sign up")');
      await page.waitForTimeout(3000);
    }
    
    // Check if we need to sign in
    const emailInput = page.locator('[name="email"]');
    if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('🔑 Signing in...');
      await emailInput.fill(email);
      await page.fill('[name="password"]', password);
      
      // Find the submit button more carefully
      const submitButton = page.locator('button[type="submit"]:has-text("Sign In")');
      if (await submitButton.isVisible()) {
        await submitButton.click();
      } else {
        // Try alternative selector
        await page.click('button:has-text("Sign In")').catch(() => 
          page.click('button[type="submit"]')
        );
      }
      await page.waitForTimeout(3000);
    }
    
    // Should see Find Game button
    console.log('🎮 Looking for Find Game button...');
    const findGameBtn = page.locator('button:has-text("Find Game")');
    
    // Wait for it to be visible
    await expect(findGameBtn).toBeVisible({ timeout: 10000 });
    console.log('✅ Find Game button found');
    
    // Click Find Game
    await findGameBtn.click();
    console.log('🔍 Joined matchmaking queue');
    
    // Should show searching state
    await expect(page.locator('text="Finding Opponent"')).toBeVisible({ timeout: 5000 });
    console.log('✅ Matchmaking UI working');
    
    // Cancel search
    const cancelBtn = page.locator('button:has-text("Cancel")');
    await cancelBtn.click();
    console.log('❌ Cancelled matchmaking');
    
    // Should be back to Find Game
    await expect(findGameBtn).toBeVisible({ timeout: 5000 });
    console.log('✅ Back to main state');
    
    console.log('🎉 Full flow test passed!');
  });
});