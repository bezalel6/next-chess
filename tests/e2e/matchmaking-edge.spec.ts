import { test, expect } from '@playwright/test';

test.describe('Matchmaking Edge Function', () => {
  test('player can join queue via edge function', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    const timestamp = Date.now();
    const email = `edge_test_${timestamp}@test.com`;
    
    // Sign up
    const signUpLink = page.locator('text="Don\'t have an account? Sign up"');
    if (await signUpLink.isVisible()) {
      await signUpLink.click();
      await page.waitForTimeout(500);
      
      await page.fill('[name="username"]', `EdgeTest_${timestamp}`);
      await page.fill('[name="email"]', email);
      await page.fill('[name="password"]', 'testpass123');
      
      await page.click('button:has-text("Sign up")');
      await page.waitForTimeout(3000);
    }
    
    // Sign in if needed
    const signInBtn = page.locator('button[type="submit"]:has-text("Sign In")');
    if (await signInBtn.isVisible()) {
      await page.fill('[name="email"]', email);
      await page.fill('[name="password"]', 'testpass123');
      await signInBtn.click();
      await page.waitForTimeout(2000);
    }
    
    // Find Game button should be visible
    const findGameBtn = page.locator('button:has-text("Find Game")');
    await expect(findGameBtn).toBeVisible({ timeout: 10000 });
    
    // Click Find Game
    await findGameBtn.click();
    
    // Should show searching state
    await expect(page.locator('text="Finding Opponent"')).toBeVisible({ timeout: 5000 });
    
    // Should have cancel button
    const cancelBtn = page.locator('button:has-text("Cancel")');
    await expect(cancelBtn).toBeVisible();
    
    // Cancel search
    await cancelBtn.click();
    
    // Should be back to Find Game
    await expect(findGameBtn).toBeVisible({ timeout: 5000 });
    
    console.log('✅ Edge function matchmaking works');
  });
});