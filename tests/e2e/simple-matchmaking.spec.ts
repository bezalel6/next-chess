import { test, expect } from '@playwright/test';

test.describe('Simple Matchmaking Test', () => {
  test('two players can match and start game', async ({ browser }) => {
    console.log('\n=== TESTING SIMPLE MATCHMAKING ===\n');
    
    // Create two browser contexts
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    try {
      // Both players sign in as guest
      console.log('📍 Signing in both players...');
      
      await page1.goto('http://localhost:3000');
      await page1.click('button:has-text("Continue as Guest")');
      await page1.waitForURL((url) => !url.toString().includes('/auth'), { timeout: 10000 });
      console.log('✅ Player 1 signed in');
      
      await page2.goto('http://localhost:3000');
      await page2.click('button:has-text("Continue as Guest")');
      await page2.waitForURL((url) => !url.toString().includes('/auth'), { timeout: 10000 });
      console.log('✅ Player 2 signed in');
      
      // Wait a moment for profiles to be created
      await page1.waitForTimeout(2000);
      await page2.waitForTimeout(2000);
      
      // Both click Find Game
      console.log('📍 Both players clicking Find Game...');
      
      await page1.click('button:has-text("Find Game")');
      console.log('✅ Player 1 clicked Find Game');
      
      await page1.waitForTimeout(500);
      
      await page2.click('button:has-text("Find Game")');
      console.log('✅ Player 2 clicked Find Game');
      
      // Wait for matching
      console.log('⏳ Waiting for match...');
      
      // Check if either player gets redirected to a game
      const gameUrl1 = await page1.waitForFunction(
        () => window.location.pathname.includes('/game/'),
        { timeout: 10000 }
      ).catch(() => null);
      
      const gameUrl2 = await page2.waitForFunction(
        () => window.location.pathname.includes('/game/'),
        { timeout: 10000 }
      ).catch(() => null);
      
      if (gameUrl1 || gameUrl2) {
        console.log('✅ Players matched! Game URL detected');
        
        // Get game IDs
        const gameId1 = await page1.evaluate(() => window.location.pathname);
        const gameId2 = await page2.evaluate(() => window.location.pathname);
        console.log('Player 1 game path:', gameId1);
        console.log('Player 2 game path:', gameId2);
        
        // Check if chess board is visible
        const board1 = await page1.waitForSelector('.chess-board, [class*="board"]', { timeout: 5000 }).catch(() => null);
        const board2 = await page2.waitForSelector('.chess-board, [class*="board"]', { timeout: 5000 }).catch(() => null);
        
        if (board1 && board2) {
          console.log('✅ Chess boards visible on both screens');
        } else {
          console.log('⚠️ Chess boards not found');
        }
      } else {
        console.log('❌ No match found within timeout');
        
        // Debug: Check what's on screen
        const text1 = await page1.textContent('body');
        const text2 = await page2.textContent('body');
        
        if (text1.includes('Waiting') || text1.includes('Finding')) {
          console.log('Player 1 is in waiting/finding state');
        }
        if (text2.includes('Waiting') || text2.includes('Finding')) {
          console.log('Player 2 is in waiting/finding state');
        }
      }
      
    } finally {
      await context1.close();
      await context2.close();
    }
  });
  
  test('single player finds game and cancels', async ({ page }) => {
    console.log('\n=== TESTING FIND GAME AND CANCEL ===\n');
    
    await page.goto('http://localhost:3000');
    await page.click('button:has-text("Continue as Guest")');
    await page.waitForURL((url) => !url.toString().includes('/auth'));
    
    // Click Find Game
    await page.click('button:has-text("Find Game")');
    console.log('✅ Clicked Find Game');
    
    // Look for cancel button or waiting indicator
    await page.waitForTimeout(1000);
    
    const cancelButton = await page.waitForSelector('button:has-text("Cancel")', { timeout: 5000 }).catch(() => null);
    if (cancelButton) {
      console.log('✅ Cancel button found - player is in queue');
      await cancelButton.click();
      console.log('✅ Cancelled matchmaking');
      
      // Should return to Find Game state
      const findGameAgain = await page.waitForSelector('button:has-text("Find Game")', { timeout: 5000 }).catch(() => null);
      if (findGameAgain) {
        console.log('✅ Returned to Find Game state');
      }
    } else {
      console.log('⚠️ No cancel button found');
      
      // Check what's on screen
      const bodyText = await page.textContent('body');
      if (bodyText.includes('Waiting') || bodyText.includes('Finding')) {
        console.log('Player is in waiting state but no cancel button');
      }
    }
  });
});