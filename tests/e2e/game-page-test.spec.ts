import { test, expect } from '@playwright/test';

test.describe('Game Page Loading', () => {
  test('game page loads and shows board after matchmaking', async ({ browser }) => {
    console.log('\n=== TESTING GAME PAGE LOADING ===\n');
    
    // Create two browser contexts
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // Enable console logging
    page1.on('console', msg => console.log('PAGE 1:', msg.text()));
    page2.on('console', msg => console.log('PAGE 2:', msg.text()));
    
    // Log network errors
    page1.on('pageerror', err => console.log('PAGE 1 ERROR:', err.message));
    page2.on('pageerror', err => console.log('PAGE 2 ERROR:', err.message));
    
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
      
      // Wait for profiles to be created
      await page1.waitForTimeout(2000);
      
      // Both click Find Game
      console.log('📍 Starting matchmaking...');
      await page1.click('button:has-text("Find Game")');
      await page1.waitForTimeout(500);
      await page2.click('button:has-text("Find Game")');
      
      // Wait for game redirect
      console.log('⏳ Waiting for game redirect...');
      
      const gameUrl1 = await page1.waitForFunction(
        () => window.location.pathname.includes('/game/'),
        { timeout: 10000 }
      ).catch(() => null);
      
      if (!gameUrl1) {
        console.log('❌ Game redirect failed');
        return;
      }
      
      const gameId = await page1.evaluate(() => window.location.pathname.split('/').pop());
      console.log('✅ Redirected to game:', gameId);
      
      // Wait a bit for React to render
      await page1.waitForTimeout(2000);
      
      // Check what's on the page
      console.log('\n📍 Checking page content...');
      
      // Check for loading message
      const loadingText = await page1.textContent('body');
      if (loadingText.includes('Loading game')) {
        console.log('⚠️ Still showing "Loading game..." message');
      }
      
      // Check for game title
      const title = await page1.waitForSelector('h1:has-text("Ban Chess Game")', { timeout: 5000 }).catch(() => null);
      if (title) {
        console.log('✅ Game title found');
      } else {
        console.log('❌ Game title not found');
      }
      
      // Check for board (using the SimpleBoard style)
      const board = await page1.waitForSelector('div[style*="inline-block"]', { timeout: 5000 }).catch(() => null);
      if (board) {
        console.log('✅ Board container found');
        
        // Count board squares
        const squares = await page1.$$('div[style*="width: 60px"]');
        console.log(`Found ${squares.length} board squares`);
        
        if (squares.length === 64) {
          console.log('✅ All 64 squares rendered');
        } else {
          console.log('❌ Incorrect number of squares');
        }
      } else {
        console.log('❌ Board container not found');
      }
      
      // Check game info
      const gameIdText = await page1.textContent('p:has-text("Game ID")').catch(() => null);
      if (gameIdText) {
        console.log('✅ Game ID displayed:', gameIdText);
      }
      
      const turnText = await page1.textContent('p:has-text("Turn")').catch(() => null);
      if (turnText) {
        console.log('✅ Turn displayed:', turnText);
      }
      
      // Check store state via console
      const storeState = await page1.evaluate(() => {
        const store = (window as any).__unifiedGameStore;
        if (store) {
          const state = store.getState();
          return {
            hasEngine: !!state.engine,
            gameId: state.gameId,
            engineFen: state.engine?.fen?.() || null
          };
        }
        return null;
      });
      
      console.log('\n📊 Store state:', JSON.stringify(storeState, null, 2));
      
      // Take screenshots for debugging
      await page1.screenshot({ path: 'test-results/game-page-player1.png' });
      await page2.screenshot({ path: 'test-results/game-page-player2.png' });
      console.log('📸 Screenshots saved to test-results/');
      
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});