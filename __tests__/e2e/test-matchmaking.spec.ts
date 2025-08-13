import { test, expect, chromium, Browser, BrowserContext, Page } from '@playwright/test';

test.describe('Matchmaking System', () => {
  test('two guests should be matched when joining queue', async () => {
    const browser = await chromium.launch({ headless: true });
    
    // Create two separate browser contexts (like incognito windows)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    // Create pages in each context
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    try {
      // Navigate both players in parallel
      await Promise.all([
        page1.goto('http://localhost:3000?clean=true'),
        page2.goto('http://localhost:3000?clean=true')
      ]);
      
      // Wait for both pages to load
      await Promise.all([
        page1.waitForLoadState('networkidle'),
        page2.waitForLoadState('networkidle')
      ]);
      
      // Check if we need to close the login dialog first (it appears to be showing)
      // Look for Continue as Guest button, if not found, close the dialog
      const guestButton1 = page1.locator('button:has-text("Continue as Guest")');
      const guestButton2 = page2.locator('button:has-text("Continue as Guest")');
      
      const hasGuestButtons = await Promise.all([
        guestButton1.isVisible().catch(() => false),
        guestButton2.isVisible().catch(() => false)
      ]);
      
      if (hasGuestButtons[0] && hasGuestButtons[1]) {
        // Both have guest buttons, click them
        await Promise.all([
          guestButton1.click(),
          guestButton2.click()
        ]);
      } else {
        // No guest buttons, close the login dialogs to access the page
        // Look for close button or click outside the dialog
        const closeButtons = await Promise.all([
          page1.locator('[aria-label="close"]').isVisible().catch(() => false),
          page2.locator('[aria-label="close"]').isVisible().catch(() => false)
        ]);
        
        if (closeButtons[0] || closeButtons[1]) {
          await Promise.all([
            page1.locator('[aria-label="close"]').click().catch(() => {}),
            page2.locator('[aria-label="close"]').click().catch(() => {})
          ]);
        } else {
          // Try pressing Escape to close dialogs
          await Promise.all([
            page1.keyboard.press('Escape'),
            page2.keyboard.press('Escape')
          ]);
        }
      }
      
      // Wait a bit for auth to complete
      await Promise.all([
        page1.waitForTimeout(2000),
        page2.waitForTimeout(2000)
      ]);
      
      // Both players join queue at exactly the same time
      await Promise.all([
        page1.click('button:has-text("Find Game")'),
        page2.click('button:has-text("Find Game")')
      ]);
      
      // Wait for matchmaking to complete (max 10 seconds)
      await Promise.all([
        page1.waitForURL('**/game/**', { timeout: 10000 }),
        page2.waitForURL('**/game/**', { timeout: 10000 })
      ]);
      
      // Verify both players are in the same game
      const gameUrl1 = page1.url();
      const gameUrl2 = page2.url();
      
      // Extract game ID from URLs
      const gameId1 = gameUrl1.match(/game\/([^/?]+)/)?.[1];
      const gameId2 = gameUrl2.match(/game\/([^/?]+)/)?.[1];
      
      expect(gameId1).toBeTruthy();
      expect(gameId2).toBeTruthy();
      expect(gameId1).toBe(gameId2); // Both should be in the same game
      
      // Verify chess board is visible for both players
      await Promise.all([
        expect(page1.locator('.cg-wrap')).toBeVisible(),
        expect(page2.locator('.cg-wrap')).toBeVisible()
      ]);
      
      console.log(`✅ Test successful! Game ID: ${gameId1}`);
      console.log(`✅ Both players matched and chess boards loaded`);
      
    } finally {
      // Clean up
      await context1.close();
      await context2.close();
      await browser.close();
    }
  });
});